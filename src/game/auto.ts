// 自动玩机器人（给验收用）。只有网址带 ?auto= 才启用：
//   ?auto=1            每个学生音符在拍点上自动送出正确输入（perfect）
//   ?auto=1&late=180   输入整体晚 180ms（模拟喇叭延迟，验 §7 第 3 条；offset 校准／自适应会照常运作）
//   ?auto=miss         关卡里全部不按（学一学与声音检查仍会自动走完，不然卡死）
// 输入走 engine/input 的 injectInput（和真实按下同一条分发路径，判定、自适应都照常），不绕过判定。
import { getContext } from '../engine/clock.ts'
import { injectInput } from '../engine/input.ts'
import type { Pad } from '../engine/config.ts'
import type { Session } from './session.ts'

export interface AutoConfig {
  on: boolean
  miss: boolean
  lateMs: number
}

let cfg: AutoConfig | null = null

export function autoConfig(): AutoConfig {
  if (cfg) return cfg
  let on = false
  let miss = false
  let lateMs = 0
  try {
    const q = new URLSearchParams(globalThis.location?.search ?? '')
    const a = q.get('auto')
    if (a !== null) {
      on = a === '1' || a === 'true' || a === 'miss'
      miss = a === 'miss'
      const l = Number(q.get('late'))
      if (Number.isFinite(l)) lateMs = l
    }
  } catch {
    // 没有网址＝不启用
  }
  cfg = { on, miss, lateMs }
  return cfg
}

export const isAuto = (): boolean => autoConfig().on

/** 在 audio 时间 (现在 + 延迟) 送一下输入（学一学第 1、2 步、校准用）。 */
export function autoTap(pad: Pad): void {
  injectInput(pad, getContext().currentTime + autoConfig().lateMs / 1000)
}

/** 排程机器人：在每个学生音符的 audio 时间（＋late）送输入。回传停止函式。 */
export function startBot(s: Session, opts: { ignoreMiss?: boolean } = {}): () => void {
  const c = autoConfig()
  if (!c.on || (c.miss && !opts.ignoreMiss)) return () => {}
  const queue: { time: number; pad: Pad }[] = []
  s.tl.rounds.forEach((lay, r) => {
    for (let i = 0; i < lay.playBeats; i++) {
      queue.push({ time: s.noteTime(r, i) + c.lateMs / 1000, pad: lay.spec.pattern[i] })
    }
  })
  queue.sort((a, b) => a.time - b.time)
  let next = 0
  const id = window.setInterval(() => {
    const now = getContext().currentTime
    while (next < queue.length && now >= queue[next].time) {
      injectInput(queue[next].pad, queue[next].time)
      next++
    }
    if (next >= queue.length) clearInterval(id)
  }, 8)
  return () => clearInterval(id)
}
