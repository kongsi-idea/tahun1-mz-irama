import type { SayKey } from '../data/say.ts'
import type { Mode } from './timeline.ts'
import type { SessionView } from './session.ts'
import type { Pose } from '../ui/Character.tsx'

/** 舞台上的提示句（key）。没有就回 null。 */
export function phaseLabel(v: SessionView | null, mode: Mode): SayKey | null {
  if (!v) return null
  switch (v.phase) {
    case 'lead':
      return 'play.ready'
    case 'demo':
      return 'play.listen'
    case 'look':
      return 'play.look'
    case 'prep':
      return 'play.yourTurn'
    case 'play':
      return mode === 'follow' ? null : 'play.yourTurn'
    default:
      return null
  }
}

/**
 * 熊的动作：示范时跟着声音换（鼓→敲鼓图、三角铁→敲三角铁图）；学生打的时候看连击——
 * 10 连击＝开心跳、20 连击＝转圈（5 连击＝摇头，是 CSS 在 idle 图上做的，见 data-tier）；
 * 休息时依表现开心／鼓励。漏掉那一瞬间的鼓励图由 game/useCheer 暂时盖上去。
 */
export function poseFor(v: SessionView | null): Pose {
  if (!v) return 'idle'
  if (v.phase === 'demo') return v.cells[v.cursor] === 'tamb' ? 'tamb' : v.cursor >= 0 ? 'drum' : 'idle'
  if (v.phase === 'play' || v.phase === 'rest' || v.phase === 'done') {
    const tier = comboTier(v.combo)
    if (tier >= 3) return 'spin'
    if (tier >= 2) return 'happy'
  }
  if (v.phase === 'rest' || v.phase === 'done') {
    const done = v.verdicts.filter((x) => x !== 'pending')
    if (done.length === 0) return 'idle'
    const bad = done.filter((x) => x === 'miss' || x === 'wrong').length
    return bad === 0 ? 'happy' : bad >= done.length / 2 ? 'cheer' : 'idle'
  }
  return 'idle'
}

export function comboTier(combo: number): number {
  return combo >= 20 ? 3 : combo >= 10 ? 2 : combo >= 5 ? 1 : 0
}
