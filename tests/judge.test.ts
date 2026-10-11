import { test } from 'node:test'
import assert from 'node:assert/strict'
import { judge, starsFor } from '../src/engine/judge.ts'
import { EXTRA_PRESS_PENALTY } from '../src/engine/config.ts'
import type { TimedPad } from '../src/engine/judge.ts'

const one = (inputMs: number, pad: 'drum' | 'tamb' = 'drum') =>
  judge([{ time: 10, pad: 'drum' }], [{ time: 10 + inputMs / 1000, pad }])

test('准点 → perfect', () => {
  const r = one(0)
  assert.equal(r.results[0].verdict, 'perfect')
  assert.equal(r.stars, 3)
})

test('+100ms / -100ms → perfect（对称）', () => {
  assert.equal(one(100).results[0].verdict, 'perfect')
  assert.equal(one(-100).results[0].verdict, 'perfect')
})

test('+200ms / -200ms → good（对称）', () => {
  for (const ms of [200, -200]) {
    const r = one(ms)
    assert.equal(r.results[0].verdict, 'good')
    assert.ok(Math.abs((r.results[0].errorMs ?? 0) - ms) < 1e-6)
  }
})

test('+300ms / -300ms → miss（输入变成多按）', () => {
  for (const ms of [300, -300]) {
    const r = one(ms)
    assert.equal(r.results[0].verdict, 'miss')
    assert.equal(r.miss, 1)
    assert.equal(r.extra, 1)
  }
})

test('窗口边界：130 完美、131 很好、230 很好、231 漏掉', () => {
  assert.equal(one(130).results[0].verdict, 'perfect')
  assert.equal(one(131).results[0].verdict, 'good')
  assert.equal(one(230).results[0].verdict, 'good')
  assert.equal(one(231).results[0].verdict, 'miss')
})

test('按错乐器（时间对）→ wrong，算失误，不是多按', () => {
  const r = one(0, 'tamb')
  assert.equal(r.results[0].verdict, 'wrong')
  assert.equal(r.wrong, 1)
  assert.equal(r.extra, 0)
  assert.equal(r.accuracy, 0)
})

const beats = (n: number): TimedPad[] =>
  Array.from({ length: n }, (_, i) => ({ time: 5 + i * 0.75, pad: i % 2 ? 'tamb' : 'drum' }))

test('多按：扣小分，不影响该音符判定', () => {
  const exp = beats(4)
  const inp: TimedPad[] = [...exp, { time: 5 + 0.75 * 1.5, pad: 'drum' }] // 两拍正中间多一下
  const r = judge(exp, inp)
  assert.deepEqual(r.results.map((x) => x.verdict), ['perfect', 'perfect', 'perfect', 'perfect'])
  assert.equal(r.extra, 1)
  assert.ok(Math.abs(r.rawAccuracy - 1) < 1e-9)
  assert.ok(Math.abs(r.accuracy - (1 - EXTRA_PRESS_PENALTY)) < 1e-9)
  assert.equal(r.stars, 3)
})

test('先按错、马上又按对：对的那下仍判准，错的变多按', () => {
  const r = judge([{ time: 10, pad: 'drum' }], [
    { time: 10.0, pad: 'tamb' },
    { time: 10.05, pad: 'drum' },
  ])
  assert.equal(r.results[0].verdict, 'perfect')
  assert.equal(r.extra, 1)
})

test('每个输入只能配一个音符：一下输入夹在两音符间，只配误差较小的', () => {
  const r = judge(
    [
      { time: 10, pad: 'drum' },
      { time: 10.4, pad: 'drum' },
    ],
    [{ time: 10.22, pad: 'drum' }],
  )
  assert.equal(r.results[1].verdict, 'good') // 离 10.4 差 180ms，比离 10 的 220ms 近
  assert.equal(r.results[0].verdict, 'miss')
})

test('offset 会先从输入时间扣掉', () => {
  const exp = beats(4)
  const inp = exp.map((n) => ({ ...n, time: n.time + 0.18 }))
  assert.equal(judge(exp, inp, 0).stars, 1) // 全是 good → 60%
  assert.equal(judge(exp, inp, 180).stars, 3)
})

test('星星门槛 60/80/93', () => {
  assert.equal(starsFor(0.59), 0)
  assert.equal(starsFor(0.6), 1)
  assert.equal(starsFor(0.8), 2)
  assert.equal(starsFor(0.93), 3)
})

test('没有音符不会 NaN', () => {
  const r = judge([], [{ time: 1, pad: 'drum' }])
  assert.equal(r.accuracy, 0)
  assert.equal(r.extra, 1)
})
