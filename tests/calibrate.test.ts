import { test } from 'node:test'
import assert from 'node:assert/strict'
import { adaptOffset, analyzeCalibration, median } from '../src/engine/calibrate.ts'
import { judge } from '../src/engine/judge.ts'
import { ADAPT_STEP_MAX_MS, ADAPT_TOTAL_MAX_MS, CAL_BEATS, CAL_USE_LAST } from '../src/engine/config.ts'
import type { TimedPad } from '../src/engine/judge.ts'

// 固定种子的随机数（mulberry32），结果可重现
function rng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const BIAS = 0.18 // 喇叭／蓝牙让玩家整体慢 180ms
const jitter = (r: () => number) => (r() * 2 - 1) * 0.02 // ±20ms

test('校准：整体 +180ms（±20ms 抖动）→ 偏移 ≈ 180ms', () => {
  const r = rng(42)
  const beatTimes = Array.from({ length: CAL_BEATS }, (_, i) => 2 + i * 0.75)
  const taps = beatTimes.map((t) => t + BIAS + jitter(r))
  const a = analyzeCalibration(beatTimes, taps)
  assert.equal(a.usedHits, CAL_USE_LAST)
  assert.equal(a.shaky, false)
  assert.ok(a.offsetMs !== null && Math.abs(a.offsetMs - 180) < 15, `offset=${a.offsetMs}`)
})

test('校准后判一轮 → ★★★；没校准（偏移 0）掉到 ★', () => {
  const r = rng(7)
  const beatTimes = Array.from({ length: CAL_BEATS }, (_, i) => 2 + i * 0.75)
  const cal = analyzeCalibration(beatTimes, beatTimes.map((t) => t + BIAS + jitter(r)))
  const offset = cal.offsetMs as number

  const notes: TimedPad[] = Array.from({ length: 8 }, (_, i) => ({
    time: 20 + i * 0.75,
    pad: i % 3 === 0 ? 'drum' : 'tamb',
  }))
  const inputs = notes.map((n) => ({ ...n, time: n.time + BIAS + jitter(r) }))
  const withCal = judge(notes, inputs, offset)
  assert.equal(withCal.stars, 3)
  assert.equal(withCal.perfect, 8)
  assert.equal(judge(notes, inputs, 0).stars, 1)
})

test('校准：漏打太多（后 8 下少于 6 下）→ 无效', () => {
  const beatTimes = Array.from({ length: CAL_BEATS }, (_, i) => 2 + i * 0.75)
  const a = analyzeCalibration(beatTimes, [beatTimes[0] + 0.1, beatTimes[7] + 0.1, beatTimes[6] + 0.1])
  assert.equal(a.offsetMs, null)
})

test('校准：前几下乱打不影响（只取后 8 下）', () => {
  const beatTimes = Array.from({ length: CAL_BEATS }, (_, i) => 2 + i * 0.75)
  const taps = beatTimes.map((t, i) => t + (i < CAL_BEATS - CAL_USE_LAST ? 0.3 : 0.1))
  const a = analyzeCalibration(beatTimes, taps)
  assert.ok(a.offsetMs !== null && Math.abs(a.offsetMs - 100) < 1e-6)
})

test('校准：忽早忽晚（±120ms）→ 仍有偏移，但标成不稳、建议再点一次', () => {
  const beatTimes = Array.from({ length: CAL_BEATS }, (_, i) => 2 + i * 0.75)
  const taps = beatTimes.map((t, i) => t + 0.1 + (i % 2 ? 0.12 : -0.12))
  const a = analyzeCalibration(beatTimes, taps)
  assert.ok(a.offsetMs !== null)
  assert.equal(a.shaky, true)
})

test('自适应：单轮最多 ±30ms', () => {
  assert.equal(adaptOffset(100, 100, [90, 100, 110]), 130)
  assert.equal(adaptOffset(100, 100, [-90, -100, -110]), 70)
  assert.equal(adaptOffset(100, 100, [10, 12, 14]), 112) // 小误差照实微调
})

test('自适应：总量限制在校准值 ±150ms', () => {
  let off = 100
  for (let i = 0; i < 20; i++) off = adaptOffset(off, 100, [200, 200, 200])
  assert.equal(off, 100 + ADAPT_TOTAL_MAX_MS)
  for (let i = 0; i < 40; i++) off = adaptOffset(off, 100, [-200, -200, -200])
  assert.equal(off, 100 - ADAPT_TOTAL_MAX_MS)
  assert.equal(adaptOffset(100, 100, [500, 500, 500]) - 100, ADAPT_STEP_MAX_MS)
})

test('自适应：样本太少不动', () => {
  assert.equal(adaptOffset(100, 100, [90, 90]), 100)
  assert.equal(adaptOffset(100, 100, []), 100)
})

test('median', () => {
  assert.equal(median([3, 1, 2]), 2)
  assert.equal(median([4, 1, 2, 3]), 2.5)
})
