import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PREP_BEATS, buildTimeline, extendPrep, segmentAt, tempoOnBarLines } from '../src/game/timeline.ts'
import type { RoundSpec } from '../src/game/timeline.ts'
import { summarize } from '../src/game/score.ts'
import { isUnlockedWith } from '../src/data/progress.ts'
import { t } from '../src/data/say.ts'

const four = (bpm: number, mode: RoundSpec['mode'] = 'echo'): RoundSpec => ({
  pattern: ['drum', 'tamb', 'tamb', 'tamb'],
  bpm,
  mode,
})

test('时间轴：echo 一轮 16 拍（示范 4＋预备 4＋学生 4＋休息 4），开场预备 4 拍；预备正好一整小节', () => {
  const tl = buildTimeline([four(80), four(80)])
  assert.equal(PREP_BEATS, 4)
  assert.equal(tl.totalBeats, 4 + 16 + 16)
  const r0 = tl.rounds[0]
  assert.equal(r0.start, 4)
  assert.equal(r0.playStart, 4 + 4 + 4)
  assert.equal(tl.rounds[1].start, 20)
  assert.equal(segmentAt(tl, 0)?.phase, 'lead')
  assert.equal(segmentAt(tl, 4)?.phase, 'demo')
  assert.equal(segmentAt(tl, 8)?.phase, 'prep')
  const prep = tl.segments.find((x) => x.phase === 'prep')
  assert.ok(prep && prep.beats === 4 && prep.start % 4 === 0, '预备＝一整小节，起点在小节线')
  assert.equal(segmentAt(tl, 12)?.phase, 'play')
  assert.equal(r0.playStart % 4, 0, '学生第一拍在小节线上')
  assert.equal(segmentAt(tl, 16)?.phase, 'rest')
  assert.equal(segmentAt(tl, tl.totalBeats), null)
})

test('时间轴：8 拍一轮 24 拍；follow 模式 n＋4；所有轮起点都在小节线', () => {
  const eight: RoundSpec = { pattern: Array(8).fill('drum'), bpm: 80, mode: 'echo' }
  const tl = buildTimeline([eight, { ...eight, mode: 'look' }])
  assert.equal(tl.rounds[0].end - tl.rounds[0].start, 24)
  assert.equal(segmentAt(tl, tl.rounds[1].start)?.phase, 'look')
  const f = buildTimeline([{ pattern: ['drum', 'drum', 'drum', 'drum'], bpm: 76, mode: 'follow' }])
  assert.equal(f.rounds[0].playStart, 4)
  assert.equal(f.totalBeats, 4 + 4 + 4)
  for (const r of [...tl.rounds, ...f.rounds]) assert.equal(r.start % 4, 0)
})

test('时间轴：每轮 bpm 不同时 tempo map 只在小节线变速', () => {
  const tl = buildTimeline([four(70), four(90), four(90), four(110)])
  assert.deepEqual(
    tl.tempoMap.map((s) => s.bpm),
    [70, 90, 110],
  )
  assert.ok(tempoOnBarLines(tl))
})

test('时间轴：所有轮（含 8 拍、变速）起点都在小节线，变速 tempo map 合法', () => {
  const eight: RoundSpec = { pattern: Array(8).fill('drum'), bpm: 70, mode: 'echo' }
  const tl = buildTimeline([eight, { ...four(90) }, { ...eight, bpm: 110, mode: 'look' }, four(110)])
  for (const r of tl.rounds) assert.equal(r.start % 4, 0)
  assert.ok(tempoOnBarLines(tl))
  assert.deepEqual(tl.tempoMap.map((x) => x.bpm), [70, 90, 110])
})

test('扶梯：学生没踏进来，预备多转一小节，之后的段、轮、变速点都往后挪 4 拍，仍在小节线', () => {
  const tl = buildTimeline([four(70), four(90)])
  const before = tl.rounds[0].playStart
  const at = extendPrep(tl, 0)
  assert.equal(at, before)
  assert.equal(tl.rounds[0].playStart, before + 4)
  const prep = tl.segments.find((x) => x.phase === 'prep' && x.round === 0)
  assert.equal(prep?.beats, 8, '预备变两小节')
  assert.equal(segmentAt(tl, before)?.phase, 'prep', '原本学生第 1 拍现在还是预备')
  assert.equal(segmentAt(tl, before + 4)?.phase, 'play')
  assert.equal(tl.rounds[1].start, 24)
  assert.equal(tl.totalBeats, 4 + 16 + 16 + 4)
  assert.deepEqual(tl.tempoMap, [{ beat: 0, bpm: 70 }, { beat: 24, bpm: 90 }])
  assert.ok(tempoOnBarLines(tl))
  for (const r of tl.rounds) assert.equal(r.playStart % 4, 0)
})

test('join 模式（学一学「听四下，再开始」）：没有开场、没有示范，预备 4 拍就换学生', () => {
  const tl = buildTimeline([{ pattern: ['drum', 'drum', 'drum', 'drum'], bpm: 76, mode: 'join' }])
  assert.equal(segmentAt(tl, 0)?.phase, 'prep')
  assert.equal(tl.rounds[0].playStart, 4)
  assert.equal(tl.totalBeats, 12)
})

test('成绩合计：全完美 3 星；多按扣分；一半漏掉不到 1 星', () => {
  const perfect = { perfect: 4, good: 0, miss: 0, wrong: 0, extra: 0 }
  assert.equal(summarize([perfect, perfect, perfect, perfect]).stars, 3)
  assert.equal(summarize([perfect, perfect, perfect, perfect]).accuracy, 1)
  const extra = summarize([{ ...perfect, extra: 5 }])
  assert.ok(Math.abs(extra.accuracy - 0.9) < 1e-9)
  assert.equal(summarize([{ perfect: 2, good: 0, miss: 2, wrong: 0, extra: 0 }]).stars, 0)
  assert.equal(summarize([{ perfect: 0, good: 4, miss: 0, wrong: 0, extra: 0 }]).stars, 1) // 0.6
})

test('解锁：第一关永远开；★ 解锁下一关（跨世界）；skip 全开', () => {
  const stars: Record<string, number> = { '1-1': 1, '1-2': 0 }
  const fn = (id: string) => stars[id] ?? 0
  assert.ok(isUnlockedWith('1-1', fn, false))
  assert.ok(isUnlockedWith('1-2', fn, false))
  assert.ok(!isUnlockedWith('1-3', fn, false))
  assert.ok(isUnlockedWith('1-3', fn, true))
  assert.ok(!isUnlockedWith('2-1', () => 0, false))
  assert.ok(isUnlockedWith('2-1', (id) => (id === '1-3' ? 1 : 0), false))
})

test('say：参数代入', () => {
  assert.equal(t('play.round', { n: 3 }), '第 3 轮')
})
