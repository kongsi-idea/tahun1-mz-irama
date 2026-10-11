// 关卡资料（规格 §3.4）：6 个世界 × 3 关＝18 关，节奏型全部写死，不随机。写完用 `npm run dump:levels` 印出来通读。
//
// ── 型别说明（C4 照填）──────────────────────────────────────────
// Cell        一格节奏：'drum'＝鼓（草莓，一年级的 ♩）、'tamb'＝三角铁（柠檬）。
// RoundDef    一轮：pattern（4 或 8 拍，一拍一格）；bpm 省略＝用关卡的 bpm，写了就覆盖（世界 4 变速：每轮不同）；
//             accent 省略＝用关卡的强拍规则，写了就覆盖（世界 3、6 的大考验同一关混用两种强拍）。
//             bpm 必须在 60–120。变速只会在轮与轮之间发生（轮的长度都是整小节，所以一定落在小节线上）。
// LevelDef    一关：
//   id        '世界-关号'，如 '1-3'。必须和 world/index 对得上。
//   world     1–6；index 1–3（第 3 关＝大考验，boss: true，每轮 8 拍）。
//   bpm       预设速度。
//   rounds    恰好 4 轮（一关 4 轮，节奏越来越难）。
//   demo      true＝熊先示范；false＝不放示范，只静静亮图标让学生看谱打（世界 5）。
//   boss      是否大考验。
//   accent    强拍规则（世界 3）：'first'＝每 4 拍的第 1 拍是强拍（鼓），其余都是三角铁；
//             'first-third'＝第 1、3 拍是强拍（鼓），其余三角铁。省略＝没有强拍规则。
//             规则写在资料里：tests/levels.test.ts 会检查「强拍位置是鼓、其余是三角铁」，画面上强拍的草莓画大一号。
//   backing   伴奏风格编号 1–6（一个世界一种，见 engine/backing.ts 的 BACKING_INFO）。
// 说明文字（关卡名、世界名）不放这里，都在 data/say.ts。
// ────────────────────────────────────────────────────────────────

export type Cell = 'drum' | 'tamb'
export type AccentRule = 'first' | 'first-third'

export interface RoundDef {
  pattern: Cell[]
  bpm?: number
  accent?: AccentRule
}

export interface LevelDef {
  id: string
  world: 1 | 2 | 3 | 4 | 5 | 6
  index: 1 | 2 | 3
  bpm: number
  rounds: RoundDef[]
  demo: boolean
  boss: boolean
  accent?: AccentRule
  backing: 1 | 2 | 3 | 4 | 5 | 6
}

export const WORLD_COUNT = 6
export const LEVELS_PER_WORLD = 3
export const BPM_MIN = 60
export const BPM_MAX = 120

/** 'DTTD' → [鼓, 三角铁, 三角铁, 鼓]（D＝drum，T＝tamb）。 */
const p = (s: string): Cell[] =>
  [...s].map((c) => {
    if (c === 'D') return 'drum'
    if (c === 'T') return 'tamb'
    throw new Error(`节奏型只能写 D 或 T：${s}`)
  })
const lv = (def: Omit<LevelDef, 'id'>): LevelDef => ({ id: `${def.world}-${def.index}`, ...def })
const r = (pattern: string, bpm?: number, accent?: AccentRule): RoundDef => {
  const o: RoundDef = { pattern: p(pattern) }
  if (bpm !== undefined) o.bpm = bpm
  if (accent) o.accent = accent
  return o
}

// 依难度排序的 4 拍节奏型（排除全部一样）：换声音的次数越少越容易。
// 1 次：DDDT DDTT DTTT TDDD TTDD TTTD ／ 2 次：DTDD DDTD DTTD TDDT TDTT TTDT ／ 3 次：DTDT TDTD

export const LEVELS: LevelDef[] = [
  // ── 世界 1 稳稳的拍子：只有鼓。节奏型只有「全鼓」，所以难度靠速度与长度（4 拍→8 拍）──
  lv({ world: 1, index: 1, bpm: 70, demo: true, boss: false, backing: 1, rounds: [r('DDDD', 70), r('DDDD', 72), r('DDDD', 74), r('DDDD', 76)] }),
  lv({ world: 1, index: 2, bpm: 76, demo: true, boss: false, backing: 1, rounds: [r('DDDD', 76), r('DDDD', 80), r('DDDDDDDD', 76), r('DDDDDDDD', 80)] }),
  lv({ world: 1, index: 3, bpm: 80, demo: true, boss: true, backing: 1, rounds: [r('DDDDDDDD', 80), r('DDDDDDDD', 83), r('DDDDDDDD', 86), r('DDDDDDDD', 90)] }),

  // ── 世界 2 两种声音：鼓和三角铁的组合（4 拍，80）；2-2 由易到难（换声音的次数 1→2→3），大考验 8 拍 ──
  lv({ world: 2, index: 1, bpm: 80, demo: true, boss: false, backing: 2, rounds: [r('DDDT'), r('DDTT'), r('TDDD'), r('TTDD')] }),
  lv({ world: 2, index: 2, bpm: 80, demo: true, boss: false, backing: 2, rounds: [r('DTDD'), r('DTTD'), r('TDTT'), r('DTDT')] }),
  lv({ world: 2, index: 3, bpm: 80, demo: true, boss: true, backing: 2, rounds: [r('DDTTDDTT'), r('DTDDDTTD'), r('TTDDTDTD'), r('DDTDTDTT')] }),

  // ── 世界 3 第一拍最重：强拍＝鼓，其余＝三角铁。3-1 只强调第 1 拍；3-2 加入第 1、3 拍；大考验两种轮流 ──
  // 强拍型只有「DTTT／DTDT」，所以靠长度（4→8 拍）与速度（80/85/90）来分轮。
  lv({ world: 3, index: 1, bpm: 80, demo: true, boss: false, backing: 3, accent: 'first', rounds: [r('DTTT', 80), r('DTTT', 85), r('DTTTDTTT', 80), r('DTTTDTTT', 85)] }),
  lv({ world: 3, index: 2, bpm: 80, demo: true, boss: false, backing: 3, accent: 'first-third', rounds: [r('DTDT', 80), r('DTDT', 85), r('DTDTDTDT', 80), r('DTDTDTDT', 85)] }),
  lv({
    world: 3, index: 3, bpm: 85, demo: true, boss: true, backing: 3,
    rounds: [r('DTTTDTTT', 85, 'first'), r('DTDTDTDT', 85, 'first-third'), r('DTTTDTTT', 90, 'first'), r('DTDTDTDT', 90, 'first-third')],
  }),

  // ── 世界 4 快快慢慢：同一个节奏先慢（70）、中（90）、快（110），第 4 轮换新节奏仍是 110 ──
  lv({ world: 4, index: 1, bpm: 70, demo: true, boss: false, backing: 4, rounds: [r('DDTT', 70), r('DDTT', 90), r('DDTT', 110), r('TTDD', 110)] }),
  lv({ world: 4, index: 2, bpm: 70, demo: true, boss: false, backing: 4, rounds: [r('DTDD', 70), r('DTDD', 90), r('DTDD', 110), r('DDTD', 110)] }),
  lv({ world: 4, index: 3, bpm: 70, demo: true, boss: true, backing: 4, rounds: [r('DDTTDDTT', 70), r('DDTTDDTT', 90), r('DDTTDDTT', 110), r('DTDDDTTD', 110)] }),

  // ── 世界 5 看谱打：不放示范，只亮图标。5-1 全 4 拍；5-2 由 4 拍到 8 拍；大考验 8 拍，85 ──
  lv({ world: 5, index: 1, bpm: 85, demo: false, boss: false, backing: 5, rounds: [r('DDTT'), r('TTDD'), r('DTDD'), r('TDTT')] }),
  lv({ world: 5, index: 2, bpm: 85, demo: false, boss: false, backing: 5, rounds: [r('DTTD'), r('TDTD'), r('DTDDTTDT'), r('TDTTDDTD')] }),
  lv({ world: 5, index: 3, bpm: 85, demo: false, boss: true, backing: 5, rounds: [r('DTDTTDDT'), r('TDTDDTTD'), r('DDTDTTDT'), r('TDDTDTTD')] }),

  // ── 世界 6 长长的回声：8 拍混合（强拍、各种组合、速度 80–100）──
  lv({ world: 6, index: 1, bpm: 80, demo: true, boss: false, backing: 6, rounds: [r('DTTTDTTT', 80, 'first'), r('DDTTTDDT'), r('DTDDDTTD'), r('TTDTDDTD')] }),
  lv({ world: 6, index: 2, bpm: 84, demo: true, boss: false, backing: 6, rounds: [r('DTDTDTDT', 84, 'first-third'), r('TDDTTDTT'), r('DDTDDTDT'), r('DTTDTDDT')] }),
  lv({
    world: 6, index: 3, bpm: 96, demo: true, boss: true, backing: 6,
    rounds: [r('DDTTTDTD'), r('DTDTDTDT', 96, 'first-third'), r('TDDTDTTD', 100), r('DTDDTTDT', 100)],
  }),
]

export const LEVEL_ORDER: string[] = (() => {
  const ids: string[] = []
  for (let w = 1; w <= WORLD_COUNT; w++) for (let i = 1; i <= LEVELS_PER_WORLD; i++) ids.push(`${w}-${i}`)
  return ids
})()

const byId = new Map(LEVELS.map((l) => [l.id, l]))

export function getLevel(id: string): LevelDef | undefined {
  return byId.get(id)
}

export function nextLevelId(id: string): string | null {
  const i = LEVEL_ORDER.indexOf(id)
  return i >= 0 && i + 1 < LEVEL_ORDER.length ? LEVEL_ORDER[i + 1] : null
}

export function prevLevelId(id: string): string | null {
  const i = LEVEL_ORDER.indexOf(id)
  return i > 0 ? LEVEL_ORDER[i - 1] : null
}

export function roundBpm(level: LevelDef, round: number): number {
  return level.rounds[round]?.bpm ?? level.bpm
}

/** 强拍位置（每 4 拍内的第几拍，0 起）。 */
export function accentBeats(rule: AccentRule | undefined): number[] {
  if (rule === 'first') return [0]
  if (rule === 'first-third') return [0, 2]
  return []
}

/** 某一轮实际用的强拍规则（轮上写了就用轮的，否则用关卡的）。 */
export function roundAccent(level: LevelDef, round: number): AccentRule | undefined {
  return level.rounds[round]?.accent ?? level.accent
}

/** 这个 pattern 里哪些格子是强拍（画面画大一号用）。 */
export function accentMask(pattern: Cell[], rule: AccentRule | undefined): boolean[] {
  const pos = accentBeats(rule)
  return pattern.map((_, i) => pos.includes(i % 4))
}
