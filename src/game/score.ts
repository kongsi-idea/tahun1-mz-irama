// 一关的总成绩：把每轮的 judge 结果合起来，算法同 judge()（规格 §2.4）。
import { EXTRA_PRESS_PENALTY, GOOD_WEIGHT, PERFECT_WEIGHT } from '../engine/config.ts'
import { starsFor } from '../engine/judge.ts'

export interface RoundTally {
  perfect: number
  good: number
  miss: number
  wrong: number
  extra: number
}

export interface LevelScore extends RoundTally {
  total: number
  accuracy: number
  stars: 0 | 1 | 2 | 3
}

export function summarize(rounds: RoundTally[]): LevelScore {
  const s: RoundTally = { perfect: 0, good: 0, miss: 0, wrong: 0, extra: 0 }
  for (const r of rounds) {
    s.perfect += r.perfect
    s.good += r.good
    s.miss += r.miss
    s.wrong += r.wrong
    s.extra += r.extra
  }
  const total = s.perfect + s.good + s.miss + s.wrong
  const raw = total === 0 ? 0 : (s.perfect * PERFECT_WEIGHT + s.good * GOOD_WEIGHT) / total
  const accuracy = Math.max(0, raw - s.extra * EXTRA_PRESS_PENALTY)
  return { ...s, total, accuracy, stars: starsFor(accuracy) }
}
