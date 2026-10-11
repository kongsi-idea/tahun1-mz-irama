import { test } from 'node:test'
import assert from 'node:assert/strict'

// 伴奏和拍子「同相」检查：用假 AudioContext 记下每个声音的 start(t) 时间，
// 用真的 Scheduler（注入假时钟）跑，对照每个 tick 的时间。
//   ① clearBeat（关卡用）：反拍 tick 完全不发声；每个拍点 tick 都有声音，且最早的声音和拍点误差 < 2ms；没有早于拍点的声音。
//   ② 第 0 拍（排程器起点）＝伴奏第 1 小节第 1 拍（beatInBar 0、tick 0、时间＝origin）。
//   ③ 完整伴奏（试听页）：只有 ±4ms 人性化抖动＋扫弦的几十毫秒琶音，不会偏半拍。
//   ④ 每一轮的起点都在伴奏的小节线上（和 timeline 对起来）。
const events: number[] = []
function node(path = 'node'): unknown {
  const fn = function () {}
  return new Proxy(fn, {
    get(_t, k) {
      if (k === 'then') return undefined
      if (k === 'sampleRate') return 48000
      if (k === 'currentTime') return 0
      if (k === 'state') return 'running'
      if (k === 'getChannelData') return (): Float32Array => new Float32Array(96000)
      return node(`${path}.${String(k)}`)
    },
    set() {
      return true
    },
    apply(_t, _this, args) {
      if (path.endsWith('.start') && typeof args[0] === 'number') events.push(args[0])
      return node(`${path}()`)
    },
  })
}
const realSetInterval = globalThis.setInterval
globalThis.setInterval = ((...a: Parameters<typeof setInterval>) => {
  const id = realSetInterval(...a)
  id.unref?.()
  return id
}) as typeof setInterval
;(globalThis as unknown as { AudioContext: unknown }).AudioContext = function () {
  return node('ctx')
}

const { attachBacking, levelBackingOptions } = await import('../src/engine/backing.ts')
const { Scheduler, tickTime } = await import('../src/engine/scheduler.ts')
const { buildTimeline } = await import('../src/game/timeline.ts')
const { LEVELS, roundBpm, accentMask, roundAccent } = await import('../src/data/levels.ts')
import type { BackingOptions, BackingStyle } from '../src/engine/backing.ts'
import type { Tick } from '../src/engine/scheduler.ts'

interface Rec {
  tick: Tick
  ev: number[]
}

const ORIGIN = 1.0

function run(style: BackingStyle, opts: BackingOptions, bpm = 100, bars = 16): Rec[] {
  let clock = 0
  const sched = new Scheduler({ tempoMap: [{ beat: 0, bpm }], now: () => clock, heard: () => clock })
  const recs: Rec[] = []
  sched.subscribe(() => {
    events.length = 0
  })
  attachBacking(sched, style, opts)
  sched.subscribe((tick) => recs.push({ tick, ev: events.slice() }))
  sched.start(ORIGIN, false)
  const end = ORIGIN + (bars * 4 * 60) / bpm
  for (clock = 0; clock < end; clock += 0.02) sched.pump()
  return recs.filter((r) => r.tick.beat < bars * 4)
}

const STYLES: BackingStyle[] = [1, 2, 3, 4, 5, 6]

test('clearBeat：6 种风格 × 有／无大考验层 × 3 种速度，四分音符位置的声音与排程器拍点误差 < 2ms，反拍不发声', () => {
  for (const style of STYLES) {
    for (const boss of [false, true]) {
      for (const bpm of [70, 100, 110]) {
        const recs = run(style, levelBackingOptions(boss), bpm)
        assert.ok(recs.length >= 16 * 8 - 2, `风格 ${style} 排出的 tick 太少 ${recs.length}`)
        for (const { tick, ev } of recs) {
          const tag = `风格 ${style} boss=${boss} bpm=${bpm} tick ${tick.tick}`
          if (!tick.isBeat) {
            assert.equal(ev.length, 0, `${tag}：反拍不该有声音`)
            continue
          }
          assert.ok(ev.length > 0, `${tag}：拍点没有声音`)
          const first = Math.min(...ev)
          assert.ok(Math.abs(first - tick.time) < 0.002, `${tag}：最早的声音偏 ${((first - tick.time) * 1000).toFixed(2)}ms`)
          for (const e of ev) assert.ok(e >= tick.time - 0.002, `${tag}：有声音早于拍点`)
        }
      }
    }
  }
})

test('第 0 拍＝伴奏第 1 小节第 1 拍；每个小节线（beatInBar 0）都对在伴奏的小节第 1 步', () => {
  for (const style of STYLES) {
    const recs = run(style, levelBackingOptions(false), 90, 8)
    const first = recs[0]
    assert.equal(first.tick.tick, 0)
    assert.equal(first.tick.bar, 0)
    assert.equal(first.tick.beatInBar, 0)
    assert.ok(Math.abs(first.tick.time - ORIGIN) < 1e-9, '排程器第 0 拍就是 origin')
    assert.ok(first.ev.length > 0 && Math.abs(Math.min(...first.ev) - ORIGIN) < 0.002, `风格 ${style}：第 1 小节第 1 拍的声音没落在 origin`)
    for (const { tick } of recs) {
      assert.equal(tick.isBeat, tick.tick % 2 === 0)
      assert.equal(tick.beatInBar === 0, tick.tick % 8 === 0, '小节线＝每 8 个 tick（伴奏一小节 8 步）')
      // 拍点时间就是 origin ＋ 拍号 × 60/bpm（不是半拍）
      assert.ok(Math.abs(tick.time - (ORIGIN + (tick.beat * 60) / 90)) < 1e-9)
    }
  }
})

test('完整伴奏（试听页，不带 clearBeat）：声音只在各自 tick 的 ±4ms 抖动之内起头，不会偏半拍', () => {
  for (const style of STYLES) {
    for (const noMel of [true, false]) {
      const recs = run(style, { noMel }, 100, 8)
      for (const { tick, ev } of recs) {
        if (ev.length === 0) continue
        const first = Math.min(...ev)
        assert.ok(first >= tick.time - 0.0041, `风格 ${style} tick ${tick.tick}：声音早于 tick`)
        // 最早的声音不会离 tick 超过 4ms 抖动＋最大琶音（3 个音 × 14ms）
        assert.ok(first - tick.time < 0.06, `风格 ${style} tick ${tick.tick}：声音晚了 ${((first - tick.time) * 1000).toFixed(1)}ms`)
      }
    }
  }
})

test('关卡时间轴：每一轮的起点都落在伴奏的小节线上（含变速关、8 拍关、看谱关）', () => {
  for (const l of LEVELS) {
    const specs = l.rounds.map((r, i) => ({
      pattern: r.pattern,
      bpm: roundBpm(l, i),
      mode: l.demo ? ('echo' as const) : ('look' as const),
      accent: accentMask(r.pattern, roundAccent(l, i)),
    }))
    const tl = buildTimeline(specs)
    for (const r of tl.rounds) {
      assert.equal(r.start % 4, 0, `${l.id} 第 ${r.index + 1} 轮起点不在小节线`)
      assert.equal((r.start * 2) % 8, 0, `${l.id} 第 ${r.index + 1} 轮起点不在伴奏的小节第 1 步`)
      assert.equal(r.playStart % 4, 0, `${l.id} 第 ${r.index + 1} 轮学生第一拍不在小节线`)
      // 小节线的 tick 时间＝该拍时间（变速后仍成立）
      const t = tickTime(0, r.start * 2, tl.tempoMap)
      assert.ok(Number.isFinite(t) && t > 0)
    }
  }
})
