import { test } from 'node:test'
import assert from 'node:assert/strict'

// 假的 AudioContext：任何呼叫都回传同样的假节点，并检查被设下去的数字（频率、音量、时间）是不是有限的正常值。
const bad: string[] = []
let nodes = 0
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
    set(_t, k, v) {
      if (typeof v === 'number' && !Number.isFinite(v)) bad.push(`${path}.${String(k)}=${v}`)
      return true
    },
    apply(_t, _this, args) {
      nodes++
      for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) bad.push(`${path}(${args.join(',')})`)
      if (/exponentialRamp/.test(path) && typeof args[0] === 'number' && args[0] <= 0) bad.push(`${path}(${args.join(',')})`)
      return node(`${path}()`)
    },
  })
}
;// clock.ts 会开一个定时校时器；让它不要卡住测试行程
const realSetInterval = globalThis.setInterval
globalThis.setInterval = ((...a: Parameters<typeof setInterval>) => {
  const id = realSetInterval(...a)
  id.unref?.()
  return id
}) as typeof setInterval
;(globalThis as unknown as { AudioContext: unknown }).AudioContext = function () {
  return node('ctx')
}

const { backingTick, BACKING_LOOP_STEPS } = await import('../src/engine/backing.ts')
import type { BackingStyle } from '../src/engine/backing.ts'

test('6 种伴奏、64 步循环、boss／noMel 组合：都能排出声音，没有 NaN／非正数', () => {
  for (const style of [1, 2, 3, 4, 5, 6] as BackingStyle[]) {
    for (const opts of [{}, { noMel: true }, { boss: true }, { noMel: true, boss: true }]) {
      const before = nodes
      for (let i = 0; i < BACKING_LOOP_STEPS * 2; i++) {
        backingTick(style, { tick: i, beat: i / 2, bar: Math.floor(i / 8), beatInBar: (i / 2) % 4, isBeat: i % 2 === 0, time: i * 0.3, stepSec: 0.3, bpm: 100 }, opts)
      }
      assert.ok(nodes > before + 100, `风格 ${style} 几乎没排声音`)
    }
  }
  assert.deepEqual(bad, [])
})
