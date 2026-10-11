// 判定（纯函数，不碰 AudioContext）。
//
// 配对规则（两种合理做法里选了这一种，手感取向：宁可给分，不要让一个错按抢走对的音符）：
//  1. 每个输入最多配一个音符，每个音符最多配一个输入。
//  2. 第一轮：只看「乐器对」的 (音符, 输入) 配对，误差（扣掉 offset 后）在「很好」窗内的，
//     按 |误差| 从小到大贪心配对（并列时先音符序号、再输入序号）。配到的判 perfect / good。
//  3. 第二轮：剩下没配到的音符，和剩下的输入里「乐器不同但时间在很好窗内」的配对，判 wrong（失误）。
//     先做乐器对的一轮，所以「先按错、马上又按对」时，对的那下仍算准，错的那下才变成多按。
//  4. 剩下的输入全部算「多按」（含离所有音符都很远的）。多按只扣 EXTRA_PRESS_PENALTY 的准确度，不改变任何音符的判定。
//  5. 没配到的音符＝miss。
// 误差符号：正＝晚、负＝早（毫秒）。errorsMs 只收 perfect/good（乐器对）的误差，给自适应用。
import {
  EXTRA_PRESS_PENALTY,
  GOOD_WEIGHT,
  GOOD_WINDOW_MS,
  PERFECT_WEIGHT,
  PERFECT_WINDOW_MS,
  STAR_THRESHOLDS,
} from './config.ts'
import type { Pad } from './config.ts'

export interface TimedPad {
  /** audio 时间（秒） */
  time: number
  pad: Pad
}
export type Verdict = 'perfect' | 'good' | 'miss' | 'wrong'

export interface NoteResult {
  verdict: Verdict
  /** 配到输入时的误差（毫秒，已扣 offset；正＝晚）；miss 为 null */
  errorMs: number | null
  inputIndex: number | null
}

export interface JudgeResult {
  results: NoteResult[]
  perfect: number
  good: number
  miss: number
  wrong: number
  /** 多按次数 */
  extra: number
  /** 没配到音符的输入序号 */
  extraInputs: number[]
  /** 不含多按扣分的准确度 0~1 */
  rawAccuracy: number
  /** 含多按扣分（最低 0） */
  accuracy: number
  stars: 0 | 1 | 2 | 3
  /** 乐器对且在很好窗内的误差（毫秒），自适应用 */
  errorsMs: number[]
}

const EPS = 1e-6

export function starsFor(accuracy: number): 0 | 1 | 2 | 3 {
  let s = 0
  for (const th of STAR_THRESHOLDS) if (accuracy + 1e-9 >= th) s++
  return s as 0 | 1 | 2 | 3
}

interface Pair {
  i: number
  j: number
  err: number
}

function greedy(pairs: Pair[], usedNote: boolean[], usedInput: boolean[]): Pair[] {
  pairs.sort((a, b) => Math.abs(a.err) - Math.abs(b.err) || a.i - b.i || a.j - b.j)
  const taken: Pair[] = []
  for (const p of pairs) {
    if (usedNote[p.i] || usedInput[p.j]) continue
    usedNote[p.i] = true
    usedInput[p.j] = true
    taken.push(p)
  }
  return taken
}

export function judge(expected: TimedPad[], inputs: TimedPad[], offsetMs = 0): JudgeResult {
  const nN = expected.length
  const nI = inputs.length
  const usedNote: boolean[] = new Array(nN).fill(false)
  const usedInput: boolean[] = new Array(nI).fill(false)
  const results: NoteResult[] = expected.map(() => ({ verdict: 'miss', errorMs: null, inputIndex: null }))

  const same: Pair[] = []
  const diff: Pair[] = []
  for (let i = 0; i < nN; i++) {
    for (let j = 0; j < nI; j++) {
      const err = (inputs[j].time - expected[i].time) * 1000 - offsetMs
      if (Math.abs(err) > GOOD_WINDOW_MS + EPS) continue
      ;(inputs[j].pad === expected[i].pad ? same : diff).push({ i, j, err })
    }
  }

  const errorsMs: number[] = []
  let perfect = 0
  let good = 0
  let wrong = 0
  for (const p of greedy(same, usedNote, usedInput)) {
    const verdict: Verdict = Math.abs(p.err) <= PERFECT_WINDOW_MS + EPS ? 'perfect' : 'good'
    if (verdict === 'perfect') perfect++
    else good++
    results[p.i] = { verdict, errorMs: p.err, inputIndex: p.j }
    errorsMs.push(p.err)
  }
  for (const p of greedy(diff, usedNote, usedInput)) {
    wrong++
    results[p.i] = { verdict: 'wrong', errorMs: p.err, inputIndex: p.j }
  }

  const extraInputs: number[] = []
  for (let j = 0; j < nI; j++) if (!usedInput[j]) extraInputs.push(j)
  const miss = nN - perfect - good - wrong

  const rawAccuracy = nN === 0 ? 0 : (perfect * PERFECT_WEIGHT + good * GOOD_WEIGHT) / nN
  const accuracy = Math.max(0, rawAccuracy - extraInputs.length * EXTRA_PRESS_PENALTY)
  return {
    results,
    perfect,
    good,
    miss,
    wrong,
    extra: extraInputs.length,
    extraInputs,
    rawAccuracy,
    accuracy,
    stars: starsFor(accuracy),
    errorsMs,
  }
}
