// lookahead 排程器。setInterval 只负责「把未来 100ms 内的事件排进 Web Audio」，不拿来计时。
// 拍点时间一律由「起点 + 拍号 × 拍长（依 tempo map 分段）」直接算出，不用 next += sec 累加，所以不会漂移。
import {
  BEATS_PER_BAR,
  LOOKAHEAD_INTERVAL_MS,
  SCHEDULE_AHEAD_S,
  START_LEAD_S,
  TICKS_PER_BEAT,
} from './config.ts'
import { getContext, heardTime } from './clock.ts'

// ---------- 纯函数：tempo map ----------

/** 从第 beat 拍起，速度为 bpm。第一段必须 beat=0；变速只在小节线（beat 是 BEATS_PER_BAR 的倍数）。 */
export interface TempoSegment {
  beat: number
  bpm: number
}
export type TempoMap = TempoSegment[]

export function validateTempoMap(map: TempoMap): void {
  if (map.length === 0 || map[0].beat !== 0) throw new Error('tempo map 第一段必须从第 0 拍开始')
  for (let i = 0; i < map.length; i++) {
    const s = map[i]
    if (!(s.bpm > 0)) throw new Error('bpm 必须 > 0')
    if (i > 0) {
      if (s.beat <= map[i - 1].beat) throw new Error('tempo map 必须按拍号递增')
      if (s.beat % BEATS_PER_BAR !== 0) throw new Error('变速只能发生在小节线')
    }
  }
}

/** 第 beat 拍（可为小数）距起点多少秒。 */
export function beatToSeconds(beat: number, map: TempoMap): number {
  if (beat <= 0) return (beat * 60) / map[0].bpm
  let sec = 0
  for (let i = 0; i < map.length; i++) {
    const seg = map[i]
    const nextBeat = i + 1 < map.length ? map[i + 1].beat : Infinity
    const end = Math.min(beat, nextBeat)
    sec += ((end - seg.beat) * 60) / seg.bpm
    if (beat <= nextBeat) break
  }
  return sec
}

/** beatToSeconds 的反函数：起点后第 sec 秒是第几拍（小数）。 */
export function secondsToBeat(sec: number, map: TempoMap): number {
  if (sec <= 0) return (sec * map[0].bpm) / 60
  let left = sec
  for (let i = 0; i < map.length; i++) {
    const seg = map[i]
    const nextBeat = i + 1 < map.length ? map[i + 1].beat : Infinity
    const segSec = ((nextBeat - seg.beat) * 60) / seg.bpm
    if (left <= segSec) return seg.beat + (left * seg.bpm) / 60
    left -= segSec
  }
  return 0 // 不会到这里（最后一段是无限长）
}

export function bpmAtBeat(beat: number, map: TempoMap): number {
  let bpm = map[0].bpm
  for (const s of map) if (s.beat <= beat) bpm = s.bpm
  return bpm
}

/** 第 tick 个 tick（八分音符）的 audio 时间。 */
export function tickTime(origin: number, tick: number, map: TempoMap): number {
  return origin + beatToSeconds(tick / TICKS_PER_BEAT, map)
}

// ---------- 排程器 ----------

export interface Tick {
  tick: number
  /** 第几拍（八分音符的反拍是 .5） */
  beat: number
  bar: number
  beatInBar: number
  /** 整拍（不是反拍） */
  isBeat: boolean
  /** 这个 tick 该响的 audio 时间 */
  time: number
  /** 这个 tick 的长度（秒），伴奏的音长用 */
  stepSec: number
  bpm: number
}

export interface SchedulerOptions {
  tempoMap: TempoMap
  /** 取得「现在」的 audio 时间；预设用 AudioContext。测试时注入假的。 */
  now?: () => number
  /** 「听到」的时间；预设用 heardTime()。 */
  heard?: () => number
}

type TickListener = (t: Tick) => void

export class Scheduler {
  private map: TempoMap
  private nowFn: () => number
  private heardFn: () => number
  private listeners = new Set<TickListener>()
  private timer: ReturnType<typeof setInterval> | null = null
  private running = false
  private originTime = 0
  private nextTick = 0
  /** 因为分页被挂起等原因，来不及发出而跳过的 tick 数 */
  missedTicks = 0

  constructor(opts: SchedulerOptions) {
    validateTempoMap(opts.tempoMap)
    this.map = opts.tempoMap.map((s) => ({ ...s }))
    this.nowFn = opts.now ?? (() => getContext().currentTime)
    this.heardFn = opts.heard ?? heardTime
  }

  get isRunning(): boolean {
    return this.running
  }
  get origin(): number {
    return this.originTime
  }
  get tempoMap(): TempoMap {
    return this.map
  }
  get nextTickIndex(): number {
    return this.nextTick
  }

  subscribe(fn: TickListener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  /** origin＝第 0 拍的 audio 时间；省略则「现在 + START_LEAD_S」。runTimer=false 供测试手动 pump()。 */
  start(origin?: number, runTimer = true): void {
    this.stop()
    this.originTime = origin ?? this.nowFn() + START_LEAD_S
    this.nextTick = 0
    this.missedTicks = 0
    this.running = true
    this.pump()
    if (runTimer) this.timer = setInterval(() => this.pump(), LOOKAHEAD_INTERVAL_MS)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.running = false
  }

  /** 把「现在 + 100ms」之前的所有 tick 发给订阅者。 */
  pump(): void {
    if (!this.running) return
    const now = this.nowFn()
    const horizon = now + SCHEDULE_AHEAD_S
    for (;;) {
      const time = tickTime(this.originTime, this.nextTick, this.map)
      if (time >= horizon) break
      const idx = this.nextTick++
      if (time < now - 0.05) {
        this.missedTicks++ // 已经过去太久，补发只会爆音
        continue
      }
      this.emit(idx, time)
    }
  }

  private emit(tick: number, time: number): void {
    const beat = tick / TICKS_PER_BEAT
    const bpm = bpmAtBeat(beat, this.map)
    const ev: Tick = {
      tick,
      beat,
      bar: Math.floor(beat / BEATS_PER_BAR),
      beatInBar: beat % BEATS_PER_BAR,
      isBeat: tick % TICKS_PER_BEAT === 0,
      time,
      stepSec: 60 / bpm / TICKS_PER_BEAT,
      bpm,
    }
    for (const fn of this.listeners) {
      try {
        fn(ev)
      } catch (e) {
        console.error('[scheduler] listener error', e)
      }
    }
  }

  /** 拍号 ≥ at 的变速点全部往后挪 delta 拍（「扶梯」多转一小节时用；只可挪还没排到的未来）。 */
  shiftTempoFrom(at: number, delta: number): void {
    for (const s of this.map) if (s.beat >= at && s.beat > 0) s.beat += delta
  }

  /** 在下一条尚未排出的小节线改速度（只影响未来的 tick，已排的不动）。回传生效的拍号。 */
  changeTempoAtNextBar(bpm: number): number {
    const nextBeat = this.nextTick / TICKS_PER_BEAT
    const at = Math.ceil(nextBeat / BEATS_PER_BAR) * BEATS_PER_BAR
    const last = this.map[this.map.length - 1]
    if (at === last.beat) last.bpm = bpm
    else if (last.bpm !== bpm) this.map.push({ beat: at, bpm })
    return at
  }

  /** 使用者「现在听到」的是第几拍（小数）；画面动效用。 */
  heardBeat(): number {
    return secondsToBeat(this.heardFn() - this.originTime, this.map)
  }
}
