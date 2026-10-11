import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  BPM_MAX,
  BPM_MIN,
  LEVELS,
  LEVEL_ORDER,
  accentBeats,
  accentMask,
  getLevel,
  nextLevelId,
  roundAccent,
  roundBpm,
} from '../src/data/levels.ts'
import { BACKING_INFO } from '../src/engine/backing.ts'
import { SAY } from '../src/data/say.ts'

test('关卡 id 唯一，且和 world／index 对得上，在 18 关表里', () => {
  const seen = new Set<string>()
  for (const l of LEVELS) {
    assert.equal(l.id, `${l.world}-${l.index}`)
    assert.ok(LEVEL_ORDER.includes(l.id), l.id)
    assert.ok(!seen.has(l.id), `重复 ${l.id}`)
    seen.add(l.id)
    assert.equal(getLevel(l.id), l)
  }
  assert.equal(LEVEL_ORDER.length, 18)
})

test('每关恰好 4 轮；每轮 4 或 8 拍；BPM 在 60–120', () => {
  for (const l of LEVELS) {
    assert.equal(l.rounds.length, 4, l.id)
    assert.ok(l.bpm >= BPM_MIN && l.bpm <= BPM_MAX, `${l.id} bpm ${l.bpm}`)
    l.rounds.forEach((r, i) => {
      assert.ok(r.pattern.length === 4 || r.pattern.length === 8, `${l.id} 第 ${i + 1} 轮 ${r.pattern.length} 拍`)
      const b = roundBpm(l, i)
      assert.ok(b >= BPM_MIN && b <= BPM_MAX, `${l.id} 第 ${i + 1} 轮 bpm ${b}`)
      for (const c of r.pattern) assert.ok(c === 'drum' || c === 'tamb')
    })
  }
})

const acc = (l: (typeof LEVELS)[number], i: number) => l.rounds[i].accent ?? l.accent
const sig = (l: (typeof LEVELS)[number], i: number) => `${l.rounds[i].pattern.join(',')}@${roundBpm(l, i)}`
const allSame = (p: readonly string[]) => p.every((c) => c === p[0])

test('大考验＝第 3 关，每轮 8 拍；伴奏编号 1–6 且等于世界号', () => {
  for (const l of LEVELS) {
    assert.equal(l.boss, l.index === 3, l.id)
    if (l.boss) for (const r of l.rounds) assert.equal(r.pattern.length, 8, l.id)
    assert.ok([1, 2, 3, 4, 5, 6].includes(l.backing), l.id)
    assert.equal(l.backing, l.world, `${l.id} 伴奏应是该世界的风格`)
  }
})

test('恰好 18 关，6 世界 × 3 关，index 只有 1|2|3', () => {
  assert.equal(LEVELS.length, 18)
  for (let w = 1; w <= 6; w++) assert.equal(LEVELS.filter((l) => l.world === w).length, 3, `世界 ${w}`)
  for (const l of LEVELS) assert.ok([1, 2, 3].includes(l.index), l.id)
  assert.equal(getLevel('1-4'), undefined) // 旧存档的 id 读不到关卡，不报错
  assert.equal(getLevel('1-5'), undefined)
})

test('同一关内 4 轮不重复（节奏型＋速度）；世界 2、5、6 的节奏型本身也不重复', () => {
  for (const l of LEVELS) {
    const s = new Set(l.rounds.map((_, i) => sig(l, i)))
    assert.equal(s.size, 4, `${l.id} 有重复的轮`)
    if (l.world === 2 || l.world === 5 || l.world === 6) {
      const ps = new Set(l.rounds.map((r) => r.pattern.join(',')))
      assert.equal(ps.size, 4, `${l.id} 节奏型重复`)
    }
  }
})

test('非世界 1 不出现「全一样」的型；世界 1 只有鼓', () => {
  for (const l of LEVELS) {
    for (const r of l.rounds) {
      if (l.world === 1) assert.ok(r.pattern.every((c) => c === 'drum'), l.id)
      else assert.ok(!allSame(r.pattern), `${l.id} 出现全一样的型`)
    }
  }
})

test('长度规则：世界 2、4 的非大考验关全 4 拍；世界 5 先 4 后 8；世界 6 全 8 拍', () => {
  const w = (n: number) => LEVELS.filter((l) => l.world === n)
  for (const l of w(2).concat(w(4))) if (!l.boss) for (const r of l.rounds) assert.equal(r.pattern.length, 4, l.id)
  // 世界 5：5-1 全 4 拍，5-2 由 4 拍加到 8 拍，大考验全 8 拍
  for (const r of w(5)[0].rounds) assert.equal(r.pattern.length, 4)
  assert.ok(w(5)[1].rounds.some((r) => r.pattern.length === 4) && w(5)[1].rounds.some((r) => r.pattern.length === 8))
  for (const r of w(6).flatMap((l) => l.rounds)) assert.equal(r.pattern.length, 8)
})

test('强拍规则：强拍位置是鼓、其余是铃鼓（含轮上覆盖的规则）', () => {
  assert.deepEqual(accentBeats('first'), [0])
  assert.deepEqual(accentBeats('first-third'), [0, 2])
  assert.deepEqual(accentBeats(undefined), [])
  assert.deepEqual(accentMask(['drum', 'tamb', 'drum', 'tamb'], 'first-third'), [true, false, true, false])
  for (const l of LEVELS) {
    l.rounds.forEach((r, ri) => {
      const rule = acc(l, ri)
      assert.equal(roundAccent(l, ri), rule)
      if (!rule) return
      const pos = accentBeats(rule)
      r.pattern.forEach((c, i) => assert.equal(c, pos.includes(i % 4) ? 'drum' : 'tamb', `${l.id} 第 ${ri + 1} 轮第 ${i + 1} 格`))
    })
  }
})

test('世界 3 强拍规则：3-1 只强调第 1 拍，3-2（first-third）加入第 1、3 拍；拍数 4→8；大考验两种都有', () => {
  const w3 = LEVELS.filter((l) => l.world === 3)
  assert.equal(w3[0].accent, 'first')
  assert.equal(w3[1].accent, 'first-third')
  for (const l of w3) for (let i = 0; i < 4; i++) assert.ok(acc(l, i), `${l.id} 第 ${i + 1} 轮没有强拍规则`)
  const boss = new Set([0, 1, 2, 3].map((i) => acc(w3[2], i)))
  assert.ok(boss.has('first') && boss.has('first-third'))
  assert.ok(w3[0].rounds.some((r) => r.pattern.length === 4) && w3[0].rounds.some((r) => r.pattern.length === 8))
  // 其他世界除了世界 6 的混合轮，不该有强拍规则
  for (const l of LEVELS) if (l.world !== 3 && l.world !== 6) assert.ok(!l.accent && l.rounds.every((r) => !r.accent), l.id)
})

test('世界 4 变速：每轮速度不递减、最后一轮比第一轮快，用到 70／90／110', () => {
  for (const l of LEVELS.filter((x) => x.world === 4)) {
    const b = l.rounds.map((_, i) => roundBpm(l, i))
    for (let i = 1; i < b.length; i++) assert.ok(b[i] >= b[i - 1], `${l.id} 速度递减 ${b}`)
    assert.ok(b[3] > b[0], l.id)
    assert.deepEqual([b[0], b[1], b[2]], [70, 90, 110], l.id)
    assert.equal(l.bpm, b[0])
    // 前三轮是同一个节奏先慢后快
    assert.equal(l.rounds[0].pattern.join(), l.rounds[1].pattern.join())
    assert.equal(l.rounds[1].pattern.join(), l.rounds[2].pattern.join())
  }
})

test('世界 5 不放示范，其余世界放示范', () => {
  for (const l of LEVELS) assert.equal(l.demo, l.world !== 5, l.id)
})

test('世界 6 速度 80–100', () => {
  for (const l of LEVELS.filter((x) => x.world === 6))
    l.rounds.forEach((_, i) => {
      const b = roundBpm(l, i)
      assert.ok(b >= 80 && b <= 100, `${l.id} ${b}`)
    })
})

test('伴奏：6 种风格都有名称与描述', () => {
  assert.equal(BACKING_INFO.length, 6)
  BACKING_INFO.forEach((b, i) => {
    assert.equal(b.style, i + 1)
    assert.ok(b.name && b.desc)
  })
})

test('nextLevelId 顺序正确', () => {
  assert.equal(nextLevelId('1-1'), '1-2')
  assert.equal(nextLevelId('1-3'), '2-1')
  assert.equal(nextLevelId('6-3'), null)
  assert.equal(nextLevelId('1-5'), null) // 旧 id：没有下一关，不报错
})

test('say.ts：6 个世界名都有', () => {
  for (let w = 1; w <= 6; w++) assert.ok((SAY as Record<string, string>)[`map.world.${w}.name`])
})

test('say.ts：乐器名、念法只在 say.ts 出现；语音档名与 manifest 对得上', async () => {
  const { VOICE_KEYS, voiceFile, voiceText, t } = await import('../src/data/say.ts')
  const { VOICE_FILES } = await import('../src/data/voice-manifest.ts')
  assert.equal(t('learn.4.say').includes('{'), false)
  assert.ok(t('learn.1.say').includes(SAY['inst.tamb']))
  for (const k of VOICE_KEYS) {
    assert.ok(voiceText(k).length > 0, k)
    assert.ok(VOICE_FILES.includes(voiceFile(k)), `${k} 没有录音（跑 python3 scripts/gen-voice.py）`)
  }
})
