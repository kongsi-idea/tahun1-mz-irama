import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BEATS_PER_BAR } from '../src/engine/config.ts'

test('type stripping 路线可行：能 import engine 的 .ts', () => {
  assert.equal(BEATS_PER_BAR, 4)
})
