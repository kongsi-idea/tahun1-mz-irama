// 合成器：master＋compressor＋程序生成回响，以及一年级打击乐（鼓、铃鼓、节拍器）。
// 合成法移植自 sound-demo.html（老师听过没否决的版本）。
import { getContext } from './clock.ts'
import { BACKING_VOLUME, MASTER_VOLUME } from './config.ts'
import type { Pad } from './config.ts'

interface Graph {
  ctx: AudioContext
  master: GainNode
  backing: GainNode
  reverbSend: GainNode
  noiseBuf: AudioBuffer
}

let graph: Graph | null = null
/** 使用者音量（设定页，0~1）；乘在 MASTER_VOLUME 上。 */
let volumeScale = 1
let backingScale = 1

export function setMasterVolume(v: number): void {
  volumeScale = Math.min(1, Math.max(0, v))
  if (graph) graph.master.gain.value = MASTER_VOLUME * volumeScale
}

function g(): Graph {
  if (graph) return graph
  const ctx = getContext()
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.ratio.value = 3
  const master = ctx.createGain()
  master.gain.value = MASTER_VOLUME * volumeScale
  master.connect(comp)
  comp.connect(ctx.destination)
  // 伴奏专用音量层（比打击声低一截）
  const backing = ctx.createGain()
  backing.gain.value = BACKING_VOLUME * backingScale
  backing.connect(master)
  // 空间回响：程序生成的衰减噪音当脉冲响应
  const len = Math.floor(ctx.sampleRate * 1.4)
  const ir = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2)
  }
  const conv = ctx.createConvolver()
  conv.buffer = ir
  const reverbSend = ctx.createGain()
  reverbSend.gain.value = 0.22
  reverbSend.connect(conv)
  conv.connect(master)
  // 共用白噪音
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const nd = noiseBuf.getChannelData(0)
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
  graph = { ctx, master, backing, reverbSend, noiseBuf }
  return graph
}

/** 建好声音链（可在首次手势里提前呼叫，避免第一声卡顿）。 */
export function initSynth(): void {
  g()
}

/** 伴奏总线音量比例（1＝原样）。关卡里调低，让节拍器压过伴奏；试听页保持 1。 */
export function setBackingLevel(scale: number): void {
  if (graph) graph.backing.gain.value = BACKING_VOLUME * scale
  backingScale = scale
}
export type Bus = 'main' | 'backing'

/** 把节点接到总线，并按 wet 比例送一份进回响。 */
export function out(node: AudioNode, wet = 1, bus: Bus = 'main'): void {
  const s = g()
  node.connect(bus === 'backing' ? s.backing : s.master)
  if (wet) {
    const w = s.ctx.createGain()
    w.gain.value = wet
    node.connect(w)
    w.connect(s.reverbSend)
  }
}

export function noise(): AudioBufferSourceNode {
  const s = g()
  const n = s.ctx.createBufferSource()
  n.buffer = s.noiseBuf
  return n
}

/** 指数包络：a 秒升到 peak，d 秒衰减到近 0。 */
export function env(gain: GainNode, t: number, peak: number, a: number, d: number): void {
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(peak, t + a)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + a + d)
}

/** 力度人性化：回传 (1-v)~1 的随机倍率。 */
export function hum(v = 0.12): number {
  return 1 - Math.random() * v
}

export function drum(t: number, v = 1): void {
  const { ctx } = g()
  v *= hum()
  const o = ctx.createOscillator()
  const og = ctx.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(190, t)
  o.frequency.exponentialRampToValueAtTime(72, t + 0.13)
  env(og, t, 0.9 * v, 0.003, 0.38)
  o.connect(og)
  out(og, 0.5)
  o.start(t)
  o.stop(t + 0.45)
  // 鼓皮泛音
  const o2 = ctx.createOscillator()
  const g2 = ctx.createGain()
  o2.type = 'triangle'
  o2.frequency.setValueAtTime(330, t)
  o2.frequency.exponentialRampToValueAtTime(180, t + 0.08)
  env(g2, t, 0.18 * v, 0.002, 0.12)
  o2.connect(g2)
  out(g2, 0.5)
  o2.start(t)
  o2.stop(t + 0.2)
  // 击打声
  const n = noise()
  const f = ctx.createBiquadFilter()
  const g3 = ctx.createGain()
  f.type = 'bandpass'
  f.frequency.value = 1800
  f.Q.value = 0.8
  env(g3, t, 0.25 * v, 0.001, 0.03)
  n.connect(f)
  f.connect(g3)
  out(g3, 0.3)
  n.start(t)
  n.stop(t + 0.06)
}

export function tamb(t: number, v = 1): void {
  const { ctx } = g()
  v *= hum()
  // 三片小铃错开
  for (let k = 0; k < 3; k++) {
    const tt = t + k * 0.009 + Math.random() * 0.004
    const n = noise()
    const hp = ctx.createBiquadFilter()
    const bp = ctx.createBiquadFilter()
    const og = ctx.createGain()
    hp.type = 'highpass'
    hp.frequency.value = 5500
    bp.type = 'bandpass'
    bp.frequency.value = 8200 + k * 900
    bp.Q.value = 3
    env(og, tt, 0.32 * v * (1 - k * 0.2), 0.002, 0.16 + Math.random() * 0.05)
    n.connect(hp)
    hp.connect(bp)
    bp.connect(og)
    out(og, 0.6)
    n.start(tt)
    n.stop(tt + 0.3)
  }
  // 金属泛音
  for (const fq of [5300, 7100, 9400]) {
    const o = ctx.createOscillator()
    const og = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = fq * (1 + (Math.random() - 0.5) * 0.01)
    env(og, t, 0.025 * v, 0.002, 0.22)
    o.connect(og)
    out(og, 0.6)
    o.start(t)
    o.stop(t + 0.3)
  }
}

/** 木鱼式节拍器。accent＝强拍（第 1 拍）音量大一点。 */
export function click(t: number, accent = false, boost = 1): void {
  const { ctx } = g()
  const v = (accent ? 1 : 0.6) * boost
  const o = ctx.createOscillator()
  const og = ctx.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(1250, t)
  o.frequency.exponentialRampToValueAtTime(900, t + 0.04)
  env(og, t, 0.22 * v, 0.001, 0.05)
  o.connect(og)
  out(og, 0.2)
  o.start(t)
  o.stop(t + 0.08)
}

export function playPad(pad: Pad, t: number, v = 1): void {
  if (pad === 'drum') drum(t, v)
  else tamb(t, v)
}
