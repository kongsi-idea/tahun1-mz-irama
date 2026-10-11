// 自动玩机器人（给验收用）。只有网址带 ?auto= 才启用：
//   ?auto=1            每个学生音符在拍点上自动送出正确输入（perfect）
//   ?auto=1&late=180   输入整体晚 180ms（模拟喇叭延迟，验 §7 第 3 条；offset 校准／自适应会照常运作）
//   ?auto=miss         关卡里全部不按（学一学与声音检查仍会自动走完，不然卡死）
//   ?auto=1&wait=2     每轮让「扶梯」先空转 2 小节才踏进来（验扶梯中途踏入）
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

/**
 * 在 audio 时间 (现在 + 延迟) 送一下输入（学一学第 1、2 步、校准用）。
 * heard=true（校准）：呼叫时机是「听到拍子」的那一刻（拍点＋喇叭延迟），扣回喇叭延迟，
 * 让机器人在校准和正式关卡里一样准时；不然校准会量到喇叭延迟，关卡里机器人反而被判「早了」。
 */
export function autoTap(pad: Pad, heard = false): void {
  const c = getContext()
  const lat = heard ? (c.outputLatency ?? c.baseLatency ?? 0) : 0
  injectInput(pad, c.currentTime - lat + autoConfig().lateMs / 1000)
}

/** 排程机器人：在每个学生音符的 audio 时间（＋late）送输入。回传停止函式。
 * 音符时间每次现算（s.noteTime）：扶梯多转一小节时整轮会往后挪。?wait=N：每轮故意让扶梯先空转 N 小节才踏进来（验扶梯用）。 */
export function startBot(s: Session, opts: { ignoreMiss?: boolean } = {}): () => void {
  const c = autoConfig()
  if (!c.on || (c.miss && !opts.ignoreMiss)) return () => {}
  let wait = 0
  try {
    wait = Math.max(0, Number(new URLSearchParams(globalThis.location?.search ?? '').get('wait')) || 0)
  } catch {
    // ignore
  }
  let r = 0
  let i = 0
  const id = window.setInterval(() => {
    const now = getContext().currentTime
    while (r < s.tl.rounds.length) {
      const lay = s.tl.rounds[r]
      if (i === 0 && lay.spec.mode !== 'follow' && s.waitsOf(r) < wait) {
        // 还要空转：等这一小节的第 1 拍过去（扶梯会自己延一小节）
        return
      }
      const time = s.noteTime(r, i) + c.lateMs / 1000
      if (now < time) return
      injectInput(lay.spec.pattern[i], time)
      i++
      if (i >= lay.playBeats) {
        r++
        i = 0
      }
    }
    clearInterval(id)
  }, 8)
  return () => clearInterval(id)
}
