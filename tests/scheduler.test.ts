import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  Scheduler,
  beatToSeconds,
  secondsToBeat,
  tickTime,
  validateTempoMap,
} from '../src/engine/scheduler.ts'
import type { Tick, TempoMap } from '../src/engine/scheduler.ts'

// 解析解：用整数毫秒×有理数算，和实作的浮点公式独立
function analytic(beat: number, segs: [number, number][]): number {
  // segs: [起始拍, bpm]
  let ms = 0
  for (let i = 0; i < segs.length; i++) {
    const [b0, bpm] = segs[i]
    const b1 = i + 1 < segs.length ? segs[i + 1][0] : Infinity
    const end = Math.min(beat, b1)
    if (end > b0) ms += ((end - b0) * 60000) / bpm
  }
  return ms / 1000
}

const FIVE_MIN = 300

for (const bpm of [80, 100, 110]) {
  test(`${bpm} BPM 连续 5 分钟：拍点和解析解误差 < 1ms`, () => {
    const map: TempoMap = [{ beat: 0, bpm }]
    const beats = Math.floor((FIVE_MIN * bpm) / 60)
    let worst = 0
    for (let b = 0; b <= beats; b++) {
      const err = Math.abs(beatToSeconds(b, map) - analytic(b, [[0, bpm]]))
      if (err > worst) worst = err
    }
    assert.ok(worst < 0.001, `worst=${worst * 1000}ms`)
  })
}

test('小节线变速 80→110→100：5 分钟内误差 < 1ms，且反函数一致', () => {
  const map: TempoMap = [
    { beat: 0, bpm: 80 },
    { beat: 80, bpm: 110 }, // 第 21 小节
    { beat: 240, bpm: 100 },
  ]
  validateTempoMap(map)
  const segs: [number, number][] = map.map((s) => [s.beat, s.bpm])
  const lastBeat = Math.floor(analytic(0, segs) + 0) + 600
  let worst = 0
  for (let b = 0; b <= lastBeat; b += 0.5) {
    const sec = beatToSeconds(b, map)
    worst = Math.max(worst, Math.abs(sec - analytic(b, segs)))
    assert.ok(Math.abs(secondsToBeat(sec, map) - b) < 1e-9)
  }
  assert.ok(worst < 0.001, `worst=${worst * 1000}ms`)
  assert.ok(beatToSeconds(lastBeat, map) > FIVE_MIN) // 确实覆盖了 5 分钟
})

test('tempo map 校验：变速必须在小节线', () => {
  assert.throws(() => validateTempoMap([{ beat: 0, bpm: 80 }, { beat: 6, bpm: 100 }]))
  assert.throws(() => validateTempoMap([{ beat: 4, bpm: 80 }]))
  assert.doesNotThrow(() => validateTempoMap([{ beat: 0, bpm: 80 }, { beat: 8, bpm: 100 }]))
})

test('Scheduler 以假时钟跑 5 分钟（25ms 一次 pump）：不漏 tick、时间和解析解一致', () => {
  let now = 0
  const s = new Scheduler({
    tempoMap: [
      { beat: 0, bpm: 90 },
      { beat: 40, bpm: 110 },
    ],
    now: () => now,
    heard: () => now,
  })
  const ticks: Tick[] = []
  s.subscribe((t) => ticks.push(t))
  s.start(0.12, false)
  for (now = 0; now < FIVE_MIN; now += 0.025) s.pump()
  assert.equal(s.missedTicks, 0)
  assert.ok(ticks.length > 1000)
  ticks.forEach((t, i) => assert.equal(t.tick, i)) // 连续无缺
  const segs: [number, number][] = [[0, 90], [40, 110]]
  let worst = 0
  for (const t of ticks) worst = Math.max(worst, Math.abs(t.time - (0.12 + analytic(t.tick / 2, segs))))
  assert.ok(worst < 0.001, `worst=${worst * 1000}ms`)
  assert.equal(ticks[0].isBeat, true)
  assert.equal(ticks[1].isBeat, false)
  assert.equal(ticks[8].bar, 1)
})

test('changeTempoAtNextBar：只影响下一条小节线之后，已排的 tick 不变', () => {
  let now = 0
  const s = new Scheduler({ tempoMap: [{ beat: 0, bpm: 80 }], now: () => now })
  const ticks: Tick[] = []
  s.subscribe((t) => ticks.push(t))
  s.start(0, false)
  for (now = 0; now < 5; now += 0.025) s.pump()
  const before = ticks.map((t) => t.time)
  const at = s.changeTempoAtNextBar(120)
  assert.equal(at % 4, 0)
  assert.ok(at * 2 >= s.nextTickIndex)
  for (; now < 20; now += 0.025) s.pump()
  ticks.slice(0, before.length).forEach((t, i) => assert.equal(t.time, before[i]))
  const after = ticks.find((t) => t.beat === at + 1)!
  assert.ok(Math.abs(after.time - (60 / 80) * at - 60 / 120) < 1e-9)
  assert.equal(after.bpm, 120)
  assert.equal(tickTime(0, at * 2, s.tempoMap), (60 / 80) * at)
})
