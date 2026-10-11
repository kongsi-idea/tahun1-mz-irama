// 唯一时钟：AudioContext.currentTime。单例；iOS 解锁；performance.now() ↔ audio 时间换算。
import { CLOCK_RESYNC_MS } from './config.ts'

interface ClockPair {
  perf: number // performance.now()（毫秒）
  audio: number // ctx.currentTime（秒）
}

let ctx: AudioContext | null = null
let pair: ClockPair = { perf: 0, audio: 0 }
let resyncTimer: ReturnType<typeof setInterval> | null = null
let unlocked = false

export function getContext(): AudioContext {
  if (!ctx) {
    const g = globalThis as unknown as {
      AudioContext?: typeof AudioContext
      webkitAudioContext?: typeof AudioContext
    }
    const Ctor = g.AudioContext ?? g.webkitAudioContext
    if (!Ctor) throw new Error('这个浏览器不支援 Web Audio')
    ctx = new Ctor({ latencyHint: 'interactive' })
    resync()
    resyncTimer = setInterval(resync, CLOCK_RESYNC_MS)
  }
  return ctx
}

/** 在第一次手势（pointerdown／keydown）里同步呼叫：resume＋播一段静音，iOS 才会放声音。 */
export function unlock(): Promise<void> {
  const c = getContext()
  const p = c.state === 'running' ? Promise.resolve() : c.resume()
  if (!unlocked) {
    unlocked = true
    try {
      const src = c.createBufferSource()
      src.buffer = c.createBuffer(1, 1, c.sampleRate)
      src.connect(c.destination)
      src.start(0)
    } catch {
      unlocked = false
    }
  }
  return p.then(resync)
}

/** 使用者「听到」的时间点＝currentTime 扣掉输出延迟。画面动效从这个值算。 */
export function heardTime(): number {
  const c = getContext()
  return c.currentTime - (c.outputLatency ?? c.baseLatency ?? 0)
}

// currentTime 不是连续走的：一个音讯回呼（约 3~20ms，看机器）才跳一次，所以单次读到的值常常落后。
// 每 CLOCK_RESYNC_MS 取一次差值（audio − perf），保留最近 RESYNC_WINDOW_MS 内的最大值：
// 刚跳完那一刻读到的差最大，也最接近真值。差值突然变很多（挂起后恢复）就整个重来。
const RESYNC_WINDOW_MS = 2000
let diffs: { at: number; d: number }[] = []

function resync(): void {
  if (!ctx) return
  const perf = performance.now()
  const d = ctx.currentTime - perf / 1000
  const best = diffs.reduce((m, x) => Math.max(m, x.d), -Infinity)
  if (diffs.length && Math.abs(d - best) > 0.05) diffs = []
  diffs = diffs.filter((x) => perf - x.at <= RESYNC_WINDOW_MS)
  diffs.push({ at: perf, d })
  const maxD = diffs.reduce((m, x) => Math.max(m, x.d), -Infinity)
  pair = { perf, audio: perf / 1000 + maxD }
}

/** 纯函数：用一组 (perf, audio) 对照点，把 performance 时间戳换成 audio 时间。 */
export function mapPerfToAudio(ts: number, p: ClockPair): number {
  return p.audio + (ts - p.perf) / 1000
}

/** event.timeStamp（performance 毫秒）→ audio 时间（秒）。 */
export function perfToAudio(ts: number): number {
  getContext()
  return mapPerfToAudio(ts, pair)
}

export function stopClockResync(): void {
  if (resyncTimer) clearInterval(resyncTimer)
  resyncTimer = null
}
