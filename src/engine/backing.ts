// 原创循环伴奏，六种风格（一个世界一种）。速度由 scheduler 的 tempo map 决定（这里只看 stepSec）。
// 每个 tick＝一个八分音符；一个循环＝8 小节×8 步＝64 步：A 段（前 4 小节）＋B 段（后 4 小节）。
// 打击声才是主角，伴奏走 'backing' 总线（较低音量）。大考验关（boss）会多加一层轻轻的闪亮音。
// ① 尤克里里小路（C 大调）② 音乐盒晚安（F 大调）——老师听过并通过，音色与 A 段不改，只补 B 段。
// ③ 小钟滴答（G 大调）④ 口风琴小镇（D 大调）⑤ 海边沙锤（A 小调，波沙诺瓦味）⑥ 彩虹竖琴（降 B 大调）。
import { getContext } from './clock.ts'
import { env, hum, noise, out } from './synth.ts'
import type { Scheduler, Tick } from './scheduler.ts'

export type BackingStyle = 1 | 2 | 3 | 4 | 5 | 6
export interface BackingOptions {
  /** 关掉旋律（回声示范用），只留和弦与节奏 */
  noMel?: boolean
  /** 大考验：多加一层轻轻的闪亮音与沙锤 */
  boss?: boolean
  /**
   * 关卡用的「拍子清楚」模式（给一年级听拍子）：
   * ① 每一拍（四分音符）都有一下柔和的低音轻拍；② 只在拍点上发声，不放反拍（八分音符）上的切分音；
   * ③ 关掉人性化的时间抖动，声音和排程器的拍点完全对齐。试听页的完整伴奏不带这个选项。
   */
  clearBeat?: boolean
}

/** 关卡里（Session）用的伴奏选项。 */
export function levelBackingOptions(boss?: boolean): BackingOptions {
  return { noMel: true, boss, clearBeat: true }
}

/** 以 C4 为 0 的半音数 → 频率 */
const N = (n: number): number => 261.63 * Math.pow(2, n / 12)

// ---------- 共用乐器 ----------
const pluckCache = new Map<number, AudioBuffer>()
function pluckBuf(freq: number): AudioBuffer {
  const key = Math.round(freq)
  const hit = pluckCache.get(key)
  if (hit) return hit
  const ctx = getContext()
  const sr = ctx.sampleRate
  const len = Math.floor(sr * 1.6)
  const buf = ctx.createBuffer(1, len, sr)
  const d = buf.getChannelData(0)
  const n = Math.round(sr / freq)
  let prev = 0
  for (let i = 0; i < n; i++) {
    const r = Math.random() * 2 - 1
    prev = prev * 0.5 + r * 0.5
    d[i] = prev
  }
  for (let i = n; i < len; i++) d[i] = 0.4985 * (d[i - n] + d[i - n + 1 < i ? i - n + 1 : i - n])
  pluckCache.set(key, buf)
  return buf
}

/** Karplus-Strong 拨弦。cutoff 越低越闷；decay 是音长（秒）。 */
function pluck(t: number, freq: number, v = 1, cutoff = 3200, decay = 1.5, gain = 0.32): void {
  const ctx = getContext()
  const s = ctx.createBufferSource()
  const og = ctx.createGain()
  const lp = ctx.createBiquadFilter()
  s.buffer = pluckBuf(freq)
  lp.type = 'lowpass'
  lp.frequency.value = cutoff
  og.gain.setValueAtTime(gain * v * hum(0.2), t)
  og.gain.exponentialRampToValueAtTime(0.0001, t + decay)
  s.connect(lp)
  lp.connect(og)
  out(og, 0.35, 'backing')
  s.start(t)
  s.stop(t + decay + 0.1)
}

function marimba(t: number, freq: number, v = 1): void {
  const ctx = getContext()
  v *= hum(0.15)
  for (const [r, a, d] of [
    [1, 0.28, 0.7],
    [3.93, 0.06, 0.12],
    [9.2, 0.015, 0.04],
  ]) {
    const o = ctx.createOscillator()
    const og = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = freq * r
    env(og, t, a * v, 0.004, d)
    o.connect(og)
    out(og, 0.45, 'backing')
    o.start(t)
    o.stop(t + d + 0.05)
  }
}

function shaker(t: number, v = 1): void {
  const ctx = getContext()
  const n = noise()
  const hp = ctx.createBiquadFilter()
  const og = ctx.createGain()
  hp.type = 'highpass'
  hp.frequency.value = 7000
  env(og, t, 0.05 * v * hum(0.4), 0.012, 0.05)
  n.connect(hp)
  hp.connect(og)
  out(og, 0.2, 'backing')
  n.start(t)
  n.stop(t + 0.1)
}

function bass(t: number, freq: number, dur: number, v = 1): void {
  const ctx = getContext()
  const o = ctx.createOscillator()
  const lp = ctx.createBiquadFilter()
  const og = ctx.createGain()
  o.type = 'triangle'
  o.frequency.value = freq
  lp.type = 'lowpass'
  lp.frequency.value = 600
  og.gain.setValueAtTime(0.0001, t)
  og.gain.exponentialRampToValueAtTime(0.3 * v, t + 0.01)
  og.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(lp)
  lp.connect(og)
  out(og, 0.1, 'backing')
  o.start(t)
  o.stop(t + dur + 0.05)
}

/** 音乐盒／钢片琴：纯净基音＋一个不成谐波的亮泛音，短衰减。 */
function musicBox(t: number, freq: number, v = 1): void {
  const ctx = getContext()
  v *= hum(0.15)
  for (const [r, a, d] of [
    [1, 0.22, 0.9],
    [2.76, 0.05, 0.35],
    [5.4, 0.014, 0.12],
  ]) {
    const o = ctx.createOscillator()
    const og = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = freq * r
    env(og, t, a * v, 0.002, d)
    o.connect(og)
    out(og, 0.55, 'backing')
    o.start(t)
    o.stop(t + d + 0.05)
  }
}

// ---------- 新增音色 ----------
/** 软钢片琴：谐波整数倍，比音乐盒温暖、不带金属味。 */
function celesta(t: number, freq: number, v = 1): void {
  const ctx = getContext()
  v *= hum(0.15)
  for (const [r, a, d] of [
    [1, 0.2, 0.8],
    [2, 0.07, 0.4],
    [4, 0.02, 0.15],
  ]) {
    const o = ctx.createOscillator()
    const og = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = freq * r
    env(og, t, a * v, 0.003, d)
    o.connect(og)
    out(og, 0.4, 'backing')
    o.start(t)
    o.stop(t + d + 0.05)
  }
}

/** 木鱼：短短的「嗒」，音高快速下滑。 */
function woodblock(t: number, v = 1, freq = 900): void {
  const ctx = getContext()
  const o = ctx.createOscillator()
  const og = ctx.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(freq * 1.5, t)
  o.frequency.exponentialRampToValueAtTime(freq, t + 0.025)
  env(og, t, 0.16 * v * hum(0.25), 0.002, 0.07)
  o.connect(og)
  out(og, 0.15, 'backing')
  o.start(t)
  o.stop(t + 0.12)
}

/** 口风琴：方波经低通变软，慢起音、轻轻颤音。dur 是音长（秒）。 */
function melodica(t: number, freq: number, dur: number, v = 1): void {
  const ctx = getContext()
  v *= hum(0.12)
  const o = ctx.createOscillator()
  const lp = ctx.createBiquadFilter()
  const og = ctx.createGain()
  const lfo = ctx.createOscillator()
  const lg = ctx.createGain()
  o.type = 'square'
  o.frequency.value = freq
  lfo.frequency.value = 5.2
  lg.gain.value = 5 // 颤音深度（音分）
  lfo.connect(lg)
  lg.connect(o.detune)
  lp.type = 'lowpass'
  lp.frequency.value = 1150
  lp.Q.value = 0.6
  og.gain.setValueAtTime(0.0001, t)
  og.gain.exponentialRampToValueAtTime(0.075 * v, t + 0.05)
  og.gain.setValueAtTime(0.075 * v, t + Math.max(0.06, dur - 0.1))
  og.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(lp)
  lp.connect(og)
  out(og, 0.3, 'backing')
  o.start(t)
  lfo.start(t)
  o.stop(t + dur + 0.05)
  lfo.stop(t + dur + 0.05)
}

/** 柔和和弦：三角波经低通，短短的一下（波卡节奏的「帕」）。 */
function chordStab(t: number, notes: number[], dur: number, v = 1): void {
  const ctx = getContext()
  for (const n of notes) {
    const o = ctx.createOscillator()
    const lp = ctx.createBiquadFilter()
    const og = ctx.createGain()
    o.type = 'triangle'
    o.frequency.value = N(n)
    lp.type = 'lowpass'
    lp.frequency.value = 900
    og.gain.setValueAtTime(0.0001, t)
    og.gain.exponentialRampToValueAtTime(0.07 * v * hum(0.2), t + 0.012)
    og.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(lp)
    lp.connect(og)
    out(og, 0.2, 'backing')
    o.start(t)
    o.stop(t + dur + 0.05)
  }
}

/** 柔软低音：正弦波加一点点二次谐波，长音。 */
function softBass(t: number, freq: number, dur: number, v = 1): void {
  const ctx = getContext()
  const o = ctx.createOscillator()
  const o2 = ctx.createOscillator()
  const g2 = ctx.createGain()
  const og = ctx.createGain()
  o.type = 'sine'
  o.frequency.value = freq
  o2.type = 'sine'
  o2.frequency.value = freq * 2
  g2.gain.value = 0.25
  og.gain.setValueAtTime(0.0001, t)
  og.gain.exponentialRampToValueAtTime(0.3 * v, t + 0.02)
  og.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(og)
  o2.connect(g2)
  g2.connect(og)
  out(og, 0.08, 'backing')
  o.start(t)
  o2.start(t)
  o.stop(t + dur + 0.05)
  o2.stop(t + dur + 0.05)
}

/** 玻璃铃（亮但不刺）：基音＋三倍音，长余音。 */
function glass(t: number, freq: number, v = 1): void {
  const ctx = getContext()
  v *= hum(0.15)
  for (const [r, a, d] of [
    [1, 0.18, 1.4],
    [3, 0.04, 0.5],
    [5.04, 0.012, 0.2],
  ]) {
    const o = ctx.createOscillator()
    const og = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = freq * r
    env(og, t, a * v, 0.004, d)
    o.connect(og)
    out(og, 0.6, 'backing')
    o.start(t)
    o.stop(t + d + 0.05)
  }
}

/** 轻拍：很短的低音「噗」（音高下滑的正弦），关卡里每一拍一下，第 1 拍稍重。 */
function thump(t: number, v = 1): void {
  const ctx = getContext()
  const o = ctx.createOscillator()
  const og = ctx.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(130, t)
  o.frequency.exponentialRampToValueAtTime(62, t + 0.09)
  env(og, t, 0.34 * v, 0.003, 0.12)
  o.connect(og)
  out(og, 0.05, 'backing')
  o.start(t)
  o.stop(t + 0.2)
}

/** 垫底长音：几个正弦波叠成和弦，慢起慢收，音量很小。 */
function pad(t: number, notes: number[], dur: number, v = 1): void {
  const ctx = getContext()
  for (const n of notes) {
    const o = ctx.createOscillator()
    const og = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = N(n)
    og.gain.setValueAtTime(0.0001, t)
    og.gain.exponentialRampToValueAtTime(0.045 * v, t + dur * 0.35)
    og.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(og)
    out(og, 0.5, 'backing')
    o.start(t)
    o.stop(t + dur + 0.05)
  }
}

/** 竖琴音：比尤克里里更亮、更长一点的拨弦。 */
const harp = (t: number, freq: number, v = 1): void => pluck(t, freq, v, 4600, 1.2, 0.26)

// ---------- 曲谱资料 ----------
type Mel = (number | null)[]

/** 旋律音长：到下一个音为止（最长 4 步）。 */
function stepsHeld(mel: Mel, s: number): number {
  let n = 1
  while (n < 4 && mel[(s + n) % mel.length] == null) n++
  return n
}

interface Song {
  /** 每小节的和弦（半音，C4＝0），8 小节 */
  ch: number[][]
  /** 每小节的根音（低八度） */
  root: number[]
  /** 64 步旋律（A 段 32＋B 段 32） */
  mel: Mel
}

// ① C 大调。A：C–G–Am–F，B：F–Em–Dm–G（回到 C）
const SONG1: Song = {
  ch: [
    [0, 4, 7],
    [7, 11, 14],
    [9, 12, 16],
    [5, 9, 12],
    [5, 9, 12],
    [4, 7, 11],
    [2, 5, 9],
    [7, 11, 14],
  ],
  root: [-24, -17, -15, -19, -19, -20, -22, -17],
  mel: [
    12, null, 14, 16, 19, null, 16, null, 14, null, 12, 14, 16, null, null, null,
    12, null, 9, null, 12, 14, 16, null, 14, 12, 9, null, 12, null, null, null,
    17, null, 16, 17, 21, null, 17, null, 16, null, 14, 16, 19, null, 16, null,
    14, null, 12, 14, 17, null, 14, null, 14, null, 11, null, 14, null, null, null,
  ],
}

// ② F 大调。A：F–Dm–Bb–C，B：Bb–F–Gm–C
const SONG2: Song = {
  ch: [
    [5, 9, 12],
    [2, 5, 9],
    [-2, 2, 5],
    [0, 4, 7],
    [-2, 2, 5],
    [5, 9, 12],
    [-5, -2, 2],
    [0, 4, 7],
  ],
  root: [-19, -10, -14, -12, -14, -19, -17, -12],
  mel: [
    17, null, null, 16, 12, null, null, null, 14, null, 17, null, 21, null, 17, null,
    19, null, null, 17, 14, null, 17, null, 16, null, 14, null, 12, null, null, null,
    17, null, 14, null, 17, null, null, null, 21, null, 17, null, 16, null, 17, null,
    19, null, null, 17, 14, null, null, null, 16, null, 12, null, 16, null, null, null,
  ],
}

// ③ G 大调「小钟滴答」。A：G–Em–C–D，B：C–D–Bm–Em
const SONG3: Song = {
  ch: [
    [7, 11, 14],
    [4, 7, 11],
    [0, 4, 7],
    [2, 6, 9],
    [0, 4, 7],
    [2, 6, 9],
    [-1, 2, 6],
    [4, 7, 11],
  ],
  root: [-17, -20, -24, -22, -24, -22, -25, -20],
  mel: [
    19, null, null, 23, 21, null, 19, null, 16, null, 19, null, 21, null, null, null,
    19, null, 16, null, 19, 21, 23, null, 21, null, 18, null, 14, null, null, null,
    24, null, 23, null, 19, null, 16, null, 21, null, 23, null, 26, null, 21, null,
    23, null, 18, null, 21, null, 18, null, 19, 21, 23, null, 19, null, null, null,
  ],
}

// ④ D 大调「口风琴小镇」。A：D–G–D–A，B：Bm–G–A–A7
const SONG4: Song = {
  ch: [
    [2, 6, 9],
    [-5, -1, 2],
    [2, 6, 9],
    [-3, 1, 4],
    [-1, 2, 6],
    [-5, -1, 2],
    [-3, 1, 4],
    [-3, 1, 4],
  ],
  root: [-22, -17, -22, -15, -13, -17, -15, -15],
  mel: [
    18, null, null, 16, 14, null, null, null, 14, null, null, 16, 19, null, null, null,
    18, null, 16, null, 14, null, 11, null, 13, null, null, null, 16, null, null, null,
    18, null, null, null, 14, null, 18, null, 19, null, null, 18, 16, null, 14, null,
    16, null, 18, null, 21, null, null, null, 19, null, 16, null, 13, null, null, null,
  ],
}

// ⑤ A 小调「海边沙锤」（波沙诺瓦）。A：Am7–Dm7–G7–Cmaj7，B：Fmaj7–Em7–Dm7–E7
const SONG5: Song = {
  ch: [
    [-3, 0, 4, 7],
    [2, 5, 9, 12],
    [-5, -1, 2, 5],
    [0, 4, 7, 11],
    [5, 9, 12, 16],
    [4, 7, 11, 14],
    [2, 5, 9, 12],
    [4, 8, 11, 14],
  ],
  root: [-15, -22, -17, -12, -19, -20, -22, -20],
  mel: [
    16, null, null, 14, 12, null, 9, null, 17, null, null, 14, 12, null, null, null,
    14, null, null, 11, 14, null, 17, null, 16, null, null, null, 19, null, 16, null,
    21, null, null, 17, 16, null, null, null, 19, null, null, 16, 14, null, null, 16,
    17, null, null, 14, 12, null, 14, null, 20, null, null, 19, 16, null, null, null,
  ],
}

// ⑥ 降 B 大调「彩虹竖琴」。A：Bb–Gm–Eb–F，B：Eb–F–Gm–F
// 竖琴用的 4 个音（根、三、五、八度）
const HARP6: number[][] = [
  [-2, 2, 5, 10],
  [-5, -2, 2, 7],
  [3, 7, 10, 15],
  [5, 9, 12, 17],
  [3, 7, 10, 15],
  [5, 9, 12, 17],
  [-5, -2, 2, 7],
  [5, 9, 12, 17],
]
const SONG6: Song = {
  ch: [
    [-2, 2, 5],
    [-5, -2, 2],
    [-9, -5, -2],
    [-7, -3, 0],
    [-9, -5, -2],
    [-7, -3, 0],
    [-5, -2, 2],
    [-7, -3, 0],
  ],
  root: [-14, -17, -21, -19, -21, -19, -17, -19],
  mel: [
    22, null, null, null, 19, null, 17, null, 19, null, null, null, 22, null, 19, null,
    15, null, 19, null, 22, null, null, null, 21, null, null, null, 24, null, 21, null,
    22, null, 19, null, 15, null, 19, null, 21, null, 24, null, 21, null, 17, null,
    22, null, null, 19, 22, null, 26, null, 24, null, null, 21, 17, null, null, null,
  ],
}

const SONGS: Record<BackingStyle, Song> = { 1: SONG1, 2: SONG2, 3: SONG3, 4: SONG4, 5: SONG5, 6: SONG6 }

// ---------- 六种风格的每步演奏 ----------
function step1(song: Song, step: number, t: number, sec: number, o: BackingOptions): void {
  const bar = Math.floor(step / 8)
  const s = step % 8
  const b = bar >= 4
  if (s === 0 || s === 4) bass(t, N(song.root[bar]), sec * 3.5, s === 0 ? 1 : 0.8)
  // 尤克里里扫弦：A 段是「欸—嘿」，B 段换成切分的扫法
  const strum = b ? [0, 3, 6, 7] : [2, 6, 7]
  if (strum.includes(s))
    song.ch[bar].forEach((n, i) => pluck(t + i * 0.014, N(n), s === 7 ? 0.5 : s === 0 ? 0.6 : 0.85))
  const m = song.mel[step]
  if (m != null && !o.noMel) marimba(t, N(m), 0.9)
  shaker(t, s % 2 ? 0.6 : 1)
}

const ARP2_A = [0, 1, 2, 1]
const ARP2_B = [2, 1, 0, 1]
function step2(song: Song, step: number, t: number, sec: number, o: BackingOptions): void {
  const bar = Math.floor(step / 8)
  const s = step % 8
  // 拨弦低音：第 1 拍与第 3 拍的反拍，轻轻摇
  if (s === 0 || s === 5) pluck(t, N(song.root[bar]), s === 0 ? 1 : 0.7, 520, sec * 5, 0.55)
  // 音乐盒琶音：每个四分音符一个和弦音（B 段改成往下走）
  if (s % 2 === 0) musicBox(t, N(song.ch[bar][(bar >= 4 ? ARP2_B : ARP2_A)[s / 2]]), 0.5)
  const m = song.mel[step]
  if (m != null && !o.noMel) musicBox(t, N(m), 0.85)
}

function step3(song: Song, step: number, t: number, sec: number, o: BackingOptions): void {
  const bar = Math.floor(step / 8)
  const s = step % 8
  const b = bar >= 4
  // 小钟：木鱼「滴—答」，第 1 拍最重
  if (s % 2 === 0) woodblock(t, s === 0 ? 1 : s === 4 ? 0.75 : 0.5, s === 0 ? 1000 : 820)
  if (b && s === 7) woodblock(t, 0.4, 700)
  if (s === 0 || s === 4) softBass(t, N(song.root[bar]), sec * 3.2, s === 0 ? 1 : 0.7)
  // 钢片琴和弦：A 段在反拍轻点，B 段多点一下
  const hits = b ? [2, 3, 6] : [2, 6]
  if (hits.includes(s)) song.ch[bar].forEach((n, i) => celesta(t + i * 0.01, N(n + 12), 0.28))
  const m = song.mel[step]
  if (m != null && !o.noMel) celesta(t, N(m), 0.85)
}

function step4(song: Song, step: number, t: number, sec: number, o: BackingOptions): void {
  const bar = Math.floor(step / 8)
  const s = step % 8
  const b = bar >= 4
  // 「噗—帕」：低音在第 1、3 拍，和弦在第 2、4 拍
  if (s === 0) softBass(t, N(song.root[bar]), sec * 2.8, 1)
  if (s === 4) softBass(t, N(song.root[bar] + 7), sec * 2.8, 0.8)
  if (s === 2 || s === 6) chordStab(t, song.ch[bar], sec * 1.8, s === 2 ? 1 : 0.85)
  if (b && s === 7) chordStab(t, song.ch[bar], sec * 0.8, 0.5)
  const m = song.mel[step]
  if (m != null && !o.noMel) melodica(t, N(m), sec * stepsHeld(song.mel, step) * 0.95, 0.9)
}

function step5(song: Song, step: number, t: number, sec: number, o: BackingOptions): void {
  const bar = Math.floor(step / 8)
  const s = step % 8
  const b = bar >= 4
  // 波沙诺瓦：低音 1、3 拍，和弦 3-3-2 切分，沙锤不停
  if (s === 0) softBass(t, N(song.root[bar]), sec * 3, 1)
  if (s === 3 || s === 4) softBass(t, N(song.root[bar] + (s === 3 ? 7 : 0)), sec * 2.2, 0.7)
  if (s === 0 || s === 3 || s === 6)
    song.ch[bar].forEach((n, i) => pluck(t + i * 0.012, N(n), s === 0 ? 0.45 : 0.75, 1900, 0.7, 0.3))
  if (b && s === 7) pluck(t, N(song.ch[bar][3]), 0.4, 1900, 0.5, 0.3)
  shaker(t, s % 2 ? 0.55 : 0.95)
  const m = song.mel[step]
  if (m != null && !o.noMel) glass(t, N(m), 0.8)
}

const HARP_PAT = [0, 1, 2, 3, 2, 1, 2, 1]
function step6(song: Song, step: number, t: number, sec: number, o: BackingOptions): void {
  const bar = Math.floor(step / 8)
  const s = step % 8
  const b = bar >= 4
  // 垫底长音＋低音，竖琴一路滚过去（B 段高一个八度）
  if (s === 0) {
    pad(t, song.ch[bar].map((n) => n + 12), sec * 8, 1)
    softBass(t, N(song.root[bar]), sec * 6, 0.9)
  }
  if (s === 4) softBass(t, N(song.root[bar] + 7), sec * 3, 0.55)
  harp(t, N(HARP6[bar][HARP_PAT[s]] + (b ? 12 : 0)), s % 2 ? 0.4 : 0.6)
  const m = song.mel[step]
  if (m != null && !o.noMel) glass(t, N(m), 0.8)
}

/** 大考验加一层：每两拍一个轻轻的高音闪亮（和弦最高音），再补一点沙锤。 */
function bossLayer(style: BackingStyle, step: number, t: number): void {
  const bar = Math.floor(step / 8)
  const s = step % 8
  if (s === 0 || s === 4) {
    const ch = SONGS[style].ch[bar]
    glass(t + 0.01, N(ch[ch.length - 1] + 12), 0.4)
  }
  if (style === 2 || style === 3 || style === 4 || style === 6) shaker(t, s % 2 ? 0.3 : 0.5)
}

export const BACKING_LOOP_STEPS = 64

export interface BackingInfo {
  style: BackingStyle
  name: string
  desc: string
}

/** 给试听页用的名称与一句描述。 */
export const BACKING_INFO: BackingInfo[] = [
  { style: 1, name: '尤克里里小路', desc: '尤克里里扫弦＋木琴旋律＋沙锤，C 大调，明亮轻快（世界 1）。' },
  { style: 2, name: '音乐盒晚安', desc: '音乐盒琶音＋拨弦低音，F 大调，慢慢摇的摇篮曲（世界 2）。' },
  { style: 3, name: '小钟滴答', desc: '木鱼滴答＋软钢片琴＋柔和低音，G 大调，像一座可爱的小钟（世界 3）。' },
  { style: 4, name: '口风琴小镇', desc: '柔和口风琴旋律＋「噗帕」低音和弦，D 大调，悠闲的小镇午后（世界 4）。' },
  { style: 5, name: '海边沙锤', desc: '沙锤＋轻拨和弦的波沙诺瓦律动＋玻璃铃，A 小调，海风吹过的感觉（世界 5）。' },
  { style: 6, name: '彩虹竖琴', desc: '竖琴一路滚过＋柔软垫底长音＋玻璃铃，降 B 大调，像彩虹铺开（世界 6）。' },
]

/** 排一个 tick 的伴奏。完整伴奏略加人性化的时间抖动（±4ms，只动声音，不动节拍时钟）；clearBeat 模式不抖。 */
export function backingTick(style: BackingStyle, tick: Tick, opts: BackingOptions = {}): void {
  const step = tick.tick % BACKING_LOOP_STEPS
  if (opts.clearBeat && step % 2 === 1) return // 拍子清楚：反拍（八分音符）不发声
  const t = tick.time + (opts.clearBeat ? 0 : (Math.random() - 0.5) * 0.008)
  const song = SONGS[style]
  const sec = tick.stepSec
  switch (style) {
    case 1:
      step1(song, step, t, sec, opts)
      break
    case 2:
      step2(song, step, t, sec, opts)
      break
    case 3:
      step3(song, step, t, sec, opts)
      break
    case 4:
      step4(song, step, t, sec, opts)
      break
    case 5:
      step5(song, step, t, sec, opts)
      break
    case 6:
      step6(song, step, t, sec, opts)
      break
  }
  if (opts.boss) bossLayer(style, step, t)
  if (opts.clearBeat) thump(t, step % 8 === 0 ? 1 : 0.6)
}

export interface BackingHandle {
  setStyle(style: BackingStyle): void
  setNoMel(noMel: boolean): void
  detach(): void
}

/** 把伴奏接到排程器上。detach() 后不再排新的声音（已排的会自然收尾）。 */
export function attachBacking(
  scheduler: Scheduler,
  style: BackingStyle = 1,
  opts: BackingOptions = {},
): BackingHandle {
  let cur = style
  const o = { ...opts }
  const unsub = scheduler.subscribe((tick) => backingTick(cur, tick, o))
  return {
    setStyle: (s) => {
      cur = s
    },
    setNoMel: (v) => {
      o.noMel = v
    },
    detach: unsub,
  }
}
