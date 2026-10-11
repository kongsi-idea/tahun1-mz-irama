// 延迟校准（12 拍「跟着拍拍看」取后 8 下误差的中位数）＋每轮自适应。
// 偏移 offsetMs 的意义：玩家的输入平均比拍点晚多少毫秒（含喇叭／蓝牙延迟与个人习惯）。
// judge() 会把每个输入的时间减去 offsetMs 再比对。
import {
  ADAPT_MIN_SAMPLES,
  ADAPT_STEP_MAX_MS,
  ADAPT_TOTAL_MAX_MS,
  CAL_BEATS,
  CAL_BPM,
  CAL_MIN_HITS,
  CAL_SHAKY_MS,
  CAL_USE_LAST,
} from './config.ts'
import { getContext, unlock } from './clock.ts'
import { onInput } from './input.ts'
import { Scheduler, beatToSeconds } from './scheduler.ts'
import { click } from './synth.ts'
import { loadNumber, saveRaw } from './storage.ts'

// ---------- 纯函数 ----------
export function median(xs: number[]): number {
  if (xs.length === 0) return NaN
  const a = [...xs].sort((x, y) => x - y)
  const m = a.length >> 1
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}

export interface CalibrationAnalysis {
  /** 每一拍的误差（毫秒，正＝晚）；没打到为 null */
  errorsMs: (number | null)[]
  /** 后 CAL_USE_LAST 拍里被配到的次数 */
  usedHits: number
  /** 偏移（毫秒）；有效下数不足时为 null */
  offsetMs: number | null
  /** 误差的中位数绝对离差（毫秒），越小越稳；没有偏移时为 null */
  spreadMs: number | null
  /** 拍子不稳（spreadMs > CAL_SHAKY_MS），建议再点一次 */
  shaky: boolean
}

/** 把每个拍点配给最近的、尚未被用的点击（±半拍内），取后 6 拍误差的中位数。 */
export function analyzeCalibration(beatTimes: number[], tapTimes: number[]): CalibrationAnalysis {
  const used: boolean[] = new Array(tapTimes.length).fill(false)
  const errorsMs: (number | null)[] = []
  for (let b = 0; b < beatTimes.length; b++) {
    const gap = (beatTimes[b + 1] ?? beatTimes[b] + (beatTimes[b] - beatTimes[b - 1])) - beatTimes[b]
    const maxDist = Math.abs(gap) / 2
    let best = -1
    let bestAbs = Infinity
    for (let j = 0; j < tapTimes.length; j++) {
      if (used[j]) continue
      const d = Math.abs(tapTimes[j] - beatTimes[b])
      if (d <= maxDist && d < bestAbs) {
        best = j
        bestAbs = d
      }
    }
    if (best < 0) errorsMs.push(null)
    else {
      used[best] = true
      errorsMs.push((tapTimes[best] - beatTimes[b]) * 1000)
    }
  }
  const tail = errorsMs.slice(-CAL_USE_LAST).filter((e): e is number => e !== null)
  const offset = tail.length >= CAL_MIN_HITS ? median(tail) : null
  const spread = offset === null ? null : median(tail.map((e) => Math.abs(e - offset)))
  return {
    errorsMs,
    usedHits: tail.length,
    offsetMs: offset,
    spreadMs: spread,
    shaky: spread !== null && spread > CAL_SHAKY_MS,
  }
}

/** 自适应：以本轮误差中位数微调，每轮最多 ±ADAPT_STEP_MAX_MS，总量限在 base ± ADAPT_TOTAL_MAX_MS。 */
export function adaptOffset(currentMs: number, baseMs: number, roundErrorsMs: number[]): number {
  if (roundErrorsMs.length < ADAPT_MIN_SAMPLES) return currentMs
  const step = clamp(median(roundErrorsMs), -ADAPT_STEP_MAX_MS, ADAPT_STEP_MAX_MS)
  return clamp(currentMs + step, baseMs - ADAPT_TOTAL_MAX_MS, baseMs + ADAPT_TOTAL_MAX_MS)
}

// ---------- 储存状态 ----------
let loaded = false
let baseMs = 0
let offsetMs = 0
let calibrated = false

function ensureLoaded(): void {
  if (loaded) return
  loaded = true
  const b = loadNumber('cal-base')
  const o = loadNumber('cal-offset')
  if (b !== null) {
    calibrated = true
    baseMs = b
    offsetMs = o ?? b
  }
}

/** 本机目前使用的偏移（毫秒）。从没校准过＝0。 */
export function getOffsetMs(): number {
  ensureLoaded()
  return offsetMs
}
export function getBaseMs(): number {
  ensureLoaded()
  return baseMs
}
/** 是否做过校准（false＝新玩家，该引导做一次）。 */
export function hasCalibration(): boolean {
  ensureLoaded()
  return calibrated
}

export function setCalibration(ms: number): void {
  ensureLoaded()
  calibrated = true
  baseMs = ms
  offsetMs = ms
  saveRaw('cal-base', String(ms))
  saveRaw('cal-offset', String(ms))
}

/** 一轮结束后呼叫，传 judge().errorsMs。回传新的偏移。 */
export function adaptAfterRound(roundErrorsMs: number[]): number {
  ensureLoaded()
  offsetMs = adaptOffset(offsetMs, baseMs, roundErrorsMs)
  saveRaw('cal-offset', String(offsetMs))
  return offsetMs
}

/**
 * 画面用的时钟（audio 秒）：圈亮、预告圈缩到底的那一刻＝系统等你按下的那一刻（拍点＋偏移）。
 * 这样「看圈按」和「听声音按」判定一致；没校准过就退回扣掉喇叭延迟（heardTime）。
 * 偏移限在 0~350ms：负的（习惯抢拍）不让画面跑到声音后面。
 */
export function visualTime(): number {
  ensureLoaded()
  const c = getContext()
  const lag = calibrated ? clamp(offsetMs, 0, 350) / 1000 : (c.outputLatency ?? c.baseLatency ?? 0)
  return c.currentTime - lag
}

// ---------- 实机校准 ----------
export interface CalibrationResult extends CalibrationAnalysis {
  ok: boolean
}

/** 播 8 拍节拍器（CAL_BPM），玩家跟着点任一乐器垫；有效则存档。 */
export async function runCalibration(onBeat?: (index: number) => void): Promise<CalibrationResult> {
  await unlock()
  const ctx = getContext()
  const sched = new Scheduler({ tempoMap: [{ beat: 0, bpm: CAL_BPM }] })
  const taps: number[] = []
  const beatTimes: number[] = []
  const offInput = onInput((e) => taps.push(e.audioTime))
  const offTick = sched.subscribe((t) => {
    if (!t.isBeat || t.beat >= CAL_BEATS) return
    beatTimes.push(t.time)
    click(t.time, t.beat === 0)
    // 点点在「听到」的那一刻亮（扣掉喇叭延迟），不比声音早
    const lat = ctx.outputLatency ?? ctx.baseLatency ?? 0
    if (onBeat) setTimeout(() => onBeat(t.beat), Math.max(0, (t.time + lat - ctx.currentTime) * 1000))
  })
  sched.start()
  const endAt = sched.origin + beatToSeconds(CAL_BEATS - 1, sched.tempoMap) + 0.6
  await new Promise<void>((resolve) => {
    const id = setInterval(() => {
      if (ctx.currentTime >= endAt) {
        clearInterval(id)
        resolve()
      }
    }, 50)
  })
  sched.stop()
  offTick()
  offInput()
  const analysis = analyzeCalibration(beatTimes, taps)
  if (analysis.offsetMs !== null) setCalibration(analysis.offsetMs)
  return { ...analysis, ok: analysis.offsetMs !== null }
}
