// 一场游戏的时间轴（纯函数，不碰 Audio）。单位：拍（beat），从排程器起点算。
// 一轮的版型：
//   echo   ：示范 n 拍 → 预备 4 拍（一整小节，「换你了！」＋大字「预备、3、2、1」，不念）→ 学生 n 拍 → 休息 4 拍
//            （长度 2n+8，n=4／8 时是 4 的倍数；休息不能是 2 拍，不然下一轮的起点会落在小节中间）
//   look   ：同 echo，但「示范」改成无声看谱（世界 5：不放示范）
//   follow ：学生 n 拍（图标随拍亮起、同时打）→ 休息 4 拍                     （学一学「一颗草莓拍一下」「第一拍最重」）
//   join   ：预备 4 拍 → 学生 n 拍 → 休息 4 拍（没有示范、没有开场；学一学「听四下，再开始」）
// 「扶梯」：预备小节会一直重复，直到学生在某个小节的第 1 拍按下去才开始（Session 呼叫 extendPrep 往后延一小节）。
// 所有轮的长度都是整小节，所以每轮的起点都在小节线上，变速（每轮 bpm 不同）可以直接写进 tempo map。
import { BEATS_PER_BAR } from '../engine/config.ts'
import type { TempoMap } from '../engine/scheduler.ts'
import type { Cell } from '../data/levels.ts'

export type Mode = 'echo' | 'look' | 'follow' | 'join'
export type PhaseName = 'lead' | 'demo' | 'look' | 'prep' | 'play' | 'rest'

export interface RoundSpec {
  pattern: Cell[]
  bpm: number
  mode: Mode
  /** 强拍位置遮罩（画面画大一号用），长度同 pattern */
  accent?: boolean[]
}

export interface Segment {
  phase: PhaseName
  /** -1＝开场预备（lead） */
  round: number
  start: number
  beats: number
}

export interface RoundLayout {
  index: number
  spec: RoundSpec
  /** 示范／看谱开始的拍（follow 模式＝playStart） */
  start: number
  playStart: number
  playBeats: number
  /** 这一轮结束（下一轮开始）的拍 */
  end: number
}

export interface Timeline {
  segments: Segment[]
  rounds: RoundLayout[]
  tempoMap: TempoMap
  totalBeats: number
}

export const LEAD_BEATS = 4
/** 预备＝一整小节：画面大字「1、2、3、4」跟拍弹出，节拍器加重，第 1 拍最重 */
export const PREP_BEATS = BEATS_PER_BAR
export const REST_BEATS_ECHO = BEATS_PER_BAR
export const REST_BEATS_FOLLOW = 4

export function buildTimeline(specs: RoundSpec[], leadBeats = LEAD_BEATS): Timeline {
  const segments: Segment[] = []
  const rounds: RoundLayout[] = []
  const tempoMap: TempoMap = [{ beat: 0, bpm: specs[0]?.bpm ?? 80 }]
  let cur = 0
  if (specs[0]?.mode === 'join') leadBeats = 0 // 预备小节本身就是开场
  if (leadBeats > 0) {
    segments.push({ phase: 'lead', round: -1, start: 0, beats: leadBeats })
    cur = leadBeats
  }
  specs.forEach((spec, index) => {
    const n = spec.pattern.length
    const start = cur
    const last = tempoMap[tempoMap.length - 1]
    if (start > 0 && spec.bpm !== last.bpm) tempoMap.push({ beat: start, bpm: spec.bpm })
    let playStart: number
    if (spec.mode === 'follow') {
      playStart = cur
      segments.push({ phase: 'play', round: index, start: cur, beats: n })
      cur += n
      segments.push({ phase: 'rest', round: index, start: cur, beats: REST_BEATS_FOLLOW })
      cur += REST_BEATS_FOLLOW
    } else {
      if (spec.mode !== 'join') {
        segments.push({ phase: spec.mode === 'look' ? 'look' : 'demo', round: index, start: cur, beats: n })
        cur += n
      }
      segments.push({ phase: 'prep', round: index, start: cur, beats: PREP_BEATS })
      cur += PREP_BEATS
      playStart = cur
      segments.push({ phase: 'play', round: index, start: cur, beats: n })
      cur += n
      segments.push({ phase: 'rest', round: index, start: cur, beats: REST_BEATS_ECHO })
      cur += REST_BEATS_ECHO
    }
    rounds.push({ index, spec, start, playStart, playBeats: n, end: cur })
  })
  return { segments, rounds, tempoMap, totalBeats: cur }
}

/**
 * 「扶梯」：第 round 轮的学生还没踏进来，预备再转一小节——预备段加长 4 拍，之后的所有段、轮、变速点都往后挪 4 拍。
 * 就地修改 tl（Session 同时要叫 Scheduler.shiftTempoFrom 挪它自己那份 tempo map）。回传挪动的起点拍号。
 */
export function extendPrep(tl: Timeline, round: number): number {
  const d = BEATS_PER_BAR
  const lay = tl.rounds[round]
  const at = lay.playStart
  for (const s of tl.segments) {
    if (s.start >= at) s.start += d
    else if (s.round === round && s.phase === 'prep') s.beats += d
  }
  lay.playStart += d
  lay.end += d
  for (const r of tl.rounds) {
    if (r.index > round) {
      r.start += d
      r.playStart += d
      r.end += d
    }
  }
  for (const t of tl.tempoMap) if (t.beat >= at) t.beat += d
  tl.totalBeats += d
  return at
}

/** 第 beat 拍（可小数）落在哪一段；超过总长回传 null。 */
export function segmentAt(tl: Timeline, beat: number): Segment | null {
  if (beat < 0) return tl.segments[0] ?? null
  for (const s of tl.segments) if (beat >= s.start && beat < s.start + s.beats) return s
  return null
}

/** 时间轴上所有速度变化点都在小节线上（给测试用）。 */
export function tempoOnBarLines(tl: Timeline): boolean {
  return tl.tempoMap.every((s) => s.beat % BEATS_PER_BAR === 0)
}
