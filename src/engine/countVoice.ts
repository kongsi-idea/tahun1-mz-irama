// 预备拍人声「预备、三、二、一」：解码成 AudioBuffer，去掉开头的静音，用 AudioContext 排在拍点上播
// （HTMLAudio 的延迟不固定，数拍子会对不准）。档案由 scripts/gen-count.py 生成。
import { getContext } from './clock.ts'
import { out } from './synth.ts'

const COUNT = 4
let bufs: (AudioBuffer | null)[] | null = null
let loading: Promise<void> | null = null

/** 开头低于这个振幅的样本当静音剪掉，让字头落在拍点上。 */
const SILENCE = 0.02

function trim(ctx: AudioContext, b: AudioBuffer): AudioBuffer {
  const d = b.getChannelData(0)
  let s = 0
  while (s < d.length && Math.abs(d[s]) < SILENCE) s++
  s = Math.max(0, s - Math.floor(b.sampleRate * 0.01)) // 留 10ms 字头
  const len = d.length - s
  if (len <= 0) return b
  const nb = ctx.createBuffer(b.numberOfChannels, len, b.sampleRate)
  for (let c = 0; c < b.numberOfChannels; c++) nb.getChannelData(c).set(b.getChannelData(c).subarray(s))
  return nb
}

/** 先载入（可重复呼叫）；载入失败就静默，不影响游戏。 */
export function loadCountVoice(): Promise<void> {
  if (loading) return loading
  const ctx = getContext()
  loading = Promise.all(
    Array.from({ length: COUNT }, (_, i) =>
      fetch(`/audio/count-${i}.mp3`)
        .then((r) => r.arrayBuffer())
        .then((ab) => ctx.decodeAudioData(ab))
        .then((b) => trim(ctx, b))
        .catch(() => null),
    ),
  ).then((list) => {
    bufs = list
  })
  return loading
}

/** 在 audio 时间 when 念预备拍第 i 拍（0＝预备，1~3＝三二一）；maxDur 秒后收掉，不拖到下一拍。 */
export function playCount(i: number, when: number, maxDur: number): void {
  const b = bufs?.[i]
  if (!b) return
  const ctx = getContext()
  const src = ctx.createBufferSource()
  src.buffer = b
  const gain = ctx.createGain()
  gain.gain.value = 1.4
  const end = when + Math.min(b.duration, maxDur)
  gain.gain.setValueAtTime(1.4, Math.max(when, end - 0.04))
  gain.gain.linearRampToValueAtTime(0.0001, end)
  src.connect(gain)
  out(gain, 0)
  src.start(when)
  src.stop(end + 0.01)
}
