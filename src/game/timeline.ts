// 一场游戏的时间轴（纯函数，不碰 Audio）。单位：拍（beat），从排程器起点算。
// 一轮的版型：
//   echo   ：示范 n 拍 → 预备 4 拍（一整小节，「换你了！」＋大字 1、2、3、4）→ 学生 n 拍 → 休息 4 拍
//            （长度 2n+8，n=4／8 时是 4 的倍数；休息不能是 2 拍，不然下一轮的起点会落在小节中间）
//   look   ：同 echo，但「示范」改成无声看谱（世界 5：不放示范）
//   follow ：学生 n 拍（图标随拍亮起、同时打）→ 休息 4 拍                     （学一学第 3、4 步）
// 所有轮的长度都是整小节，所以每轮的起点都在小节线上，变速（每轮 bpm 不同）可以直接写进 tempo map。
import { BEATS_PER_BAR } from '../engine/config.ts'
import type { TempoMap } from '../engine/scheduler.ts'
import type { Cell } from '../data/levels.ts'

export type Mode = 'echo' | 'look' | 'follow'
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
      segments.push({ phase: spec.mode === 'look' ? 'look' : 'demo', round: index, start: cur, beats: n })
      cur += n
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
