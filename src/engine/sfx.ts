// 结算音效（合成，柔和）：星星「叮」、新纪录闪光、解锁新朋友。不碰 backing.ts；全部走 synth 的 out()，吃总音量设定。
import { getContext } from './clock.ts'
import { env, out } from './synth.ts'

const STAR_NOTES = [523.25, 659.25, 783.99] // C5 E5 G5：一颗比一颗高

function bell(freq: number, t: number, peak = 0.2, decay = 0.9, wet = 0.5): void {
  const ctx = getContext()
  const g = ctx.createGain()
  env(g, t, peak, 0.006, decay)
  // 基音＋二倍音（带点铃的亮度）＋很轻的三倍音
  for (const [mul, vol] of [
    [1, 1],
    [2, 0.28],
    [3, 0.07],
  ] as const) {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = freq * mul
    const og = ctx.createGain()
    og.gain.value = vol
    o.connect(og)
    og.connect(g)
    o.start(t)
    o.stop(t + decay + 0.1)
  }
  out(g, wet)
}

/** 第 i 颗星落地的「叮」（i＝0,1,2，音越来越高）。 */
export function playStarDing(i: number, when?: number): void {
  const t = when ?? getContext().currentTime + 0.01
  bell(STAR_NOTES[Math.min(2, Math.max(0, i))], t)
}

/** 「新纪录！」贴纸弹入：一小串往上的亮音。 */
export function playSparkle(when?: number): void {
  const t0 = when ?? getContext().currentTime + 0.01
  ;[1046.5, 1318.5, 1568, 2093].forEach((f, k) => bell(f, t0 + k * 0.07, 0.1, 0.5, 0.6))
}

/** 解锁新朋友：C E G 高 C 的小号角（还是铃音，不刺耳）。 */
export function playUnlock(when?: number): void {
  const t0 = when ?? getContext().currentTime + 0.01
  ;[523.25, 659.25, 783.99, 1046.5].forEach((f, k) => bell(f, t0 + k * 0.11, 0.17, k === 3 ? 1.2 : 0.7, 0.55))
}
