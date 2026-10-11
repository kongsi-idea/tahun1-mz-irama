// 输入：pointerdown（多指）＋键盘。按下当下就播声音（立即回馈），并回报换算成 audio 时间的时间戳。
import { perfToAudio, getContext, unlock } from './clock.ts'
import { playPad } from './synth.ts'
import type { Pad } from './config.ts'

export interface InputEvent {
  pad: Pad
  /** 按下的 audio 时间（秒），由 event.timeStamp 经 perfToAudio 换算 */
  audioTime: number
  source: 'pointer' | 'key' | 'auto'
}

type Listener = (e: InputEvent) => void
const listeners = new Set<Listener>()
let soundOn = true

export function onInput(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** 关掉后按下不再自动发声（例如由别处负责播）。预设开。 */
export function setInputSound(on: boolean): void {
  soundOn = on
}

function fire(pad: Pad, ts: number, source: InputEvent['source']): void {
  // 某些旧浏览器 timeStamp 是 epoch 毫秒，不能直接换算
  const stamp = ts > 1e11 || ts <= 0 ? performance.now() : ts
  const audioTime = perfToAudio(stamp)
  if (soundOn) playPad(pad, getContext().currentTime)
  for (const fn of listeners) {
    try {
      fn({ pad, audioTime, source })
    } catch (e) {
      console.error('[input] listener error', e)
    }
  }
}

/**
 * 自动玩机器人专用（?auto=1）：和真实按下走同一条路（同样发声、同样通知所有 onInput 监听者，包含判定用的 Session），
 * 只是时间戳由呼叫者指定（audio 时间）。时间在未来时声音排在那个时间播。
 */
export function injectInput(pad: Pad, audioTime: number): void {
  const now = getContext().currentTime
  if (soundOn) playPad(pad, Math.max(now, audioTime))
  for (const fn of listeners) {
    try {
      fn({ pad, audioTime, source: 'auto' })
    } catch (e) {
      console.error('[input] listener error', e)
    }
  }
}

/** 把元素变成乐器垫：pointerdown 即响，多指各自独立。回传解除函数。 */
export function bindPad(el: HTMLElement, pad: Pad): () => void {
  el.style.touchAction = 'none'
  const down = (e: PointerEvent) => {
    e.preventDefault()
    void unlock()
    fire(pad, e.timeStamp, 'pointer')
  }
  el.addEventListener('pointerdown', down)
  return () => el.removeEventListener('pointerdown', down)
}

const KEY_MAP: Record<string, Pad> = {
  ArrowLeft: 'drum',
  f: 'drum',
  F: 'drum',
  ArrowRight: 'tamb',
  j: 'tamb',
  J: 'tamb',
}

/** 键盘：←／F＝鼓，→／J＝三角铁。长按不重复触发。 */
export function bindKeyboard(target: Window | HTMLElement = window): () => void {
  const down = ((e: KeyboardEvent) => {
    const pad = KEY_MAP[e.key]
    if (!pad || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
    e.preventDefault()
    void unlock()
    fire(pad, e.timeStamp, 'key')
  }) as EventListener
  target.addEventListener('keydown', down)
  return () => target.removeEventListener('keydown', down)
}
