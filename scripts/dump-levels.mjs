// 把 18 关印成可读文字（规格 §7 第 7 条：Opus 通读）。同时存一份到 docs/levels-dump.txt。
// 用法：npm run dump:levels   （直接读 .ts，需要 node ≥ 22.6）
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LEVELS, accentMask, roundAccent, roundBpm } from '../src/data/levels.ts'
import { BACKING_INFO } from '../src/engine/backing.ts'
import { SAY } from '../src/data/say.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const NAME = { drum: '鼓', tamb: '铃' }
const RULE = { first: '强拍:1', 'first-third': '强拍:1,3' }

const lines = []
lines.push('# 软糖回声乐园 · 18 关列印（鼓＝鼓，铃＝铃鼓；* 号＝强拍，画面上画大一号）')
lines.push('# 格式：关卡  速度  示范/看图  [大考验]  伴奏  | 各轮（4 轮，每轮 bpm 与前一轮不同时才标注）')
lines.push('')
let world = 0
for (const l of LEVELS) {
  if (l.world !== world) {
    world = l.world
    lines.push(`== 世界 ${world} ${SAY[`map.world.${world}.name`]}`)
  }
  const style = BACKING_INFO.find((b) => b.style === l.backing)
  const head = [
    l.id,
    `${l.bpm}BPM`.padEnd(7),
    l.demo ? '示范  ' : '无示范',
    l.boss ? '大考验' : '      ',
    `伴奏${l.backing}${style ? style.name : '?'}`,
    l.accent ? `[强拍:${RULE[l.accent].slice(3)}]` : '',
  ].filter((x) => x !== '').join('  ')
  let prev = l.bpm
  const rounds = l.rounds.map((r, i) => {
    const mask = accentMask(r.pattern, roundAccent(l, i))
    const cells = r.pattern.map((c, k) => NAME[c] + (mask[k] ? '*' : '')).join(' ')
    const b = roundBpm(l, i)
    let tag = ''
    if (b !== prev) tag += ` @${b}`
    prev = b
    if (r.accent && r.accent !== l.accent) tag += ` [${RULE[r.accent]}]`
    return cells + tag
  })
  lines.push(`${head}  | ${rounds.join(' | ')}`)
}
lines.push('')
const text = lines.join('\n')
console.log(text)
mkdirSync(join(root, 'docs'), { recursive: true })
writeFileSync(join(root, 'docs', 'levels-dump.txt'), text)
