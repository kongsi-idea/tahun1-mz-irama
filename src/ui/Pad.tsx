import { useEffect, useRef } from 'react'
import { bindPad, onInput } from '../engine/input.ts'
import type { Pad as PadId } from '../engine/config.ts'
import Art from './Art.tsx'
import { t } from '../data/say.ts'

const MIN_PRESS_MS = 60 // 压扁至少停这么久再弹回（规格 §5.4）

// 乐器垫：pointerdown 即响（engine/input 负责声音与时间戳），多指可同时按。
// 垫子图本身就是软糖垫：只放图＋下方文字，不再包 CSS 方块（图读不到才退回 .pad-ph 占位）。
// 外层 .pad 吃每拍脉动（--pulse），图（.pad-art）吃按下的压扁，两个 transform 互不干扰。
export default function Pad({ pad }: { pad: PadId }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const unbind = bindPad(el, pad)
    let downAt = 0
    let timer = 0
    const release = () => {
      const wait = Math.max(0, MIN_PRESS_MS - (performance.now() - downAt))
      clearTimeout(timer)
      timer = window.setTimeout(() => el.classList.remove('is-pressed'), wait)
    }
    const press = () => {
      downAt = performance.now()
      clearTimeout(timer)
      el.classList.add('is-pressed')
    }
    el.addEventListener('pointerdown', press)
    el.addEventListener('pointerup', release)
    el.addEventListener('pointercancel', release)
    el.addEventListener('pointerleave', release)
    const unsub = onInput((e) => {
      if (e.pad === pad && e.source !== 'pointer') {
        press()
        setTimeout(release, 100)
      }
    })
    return () => {
      unbind()
      unsub()
      clearTimeout(timer)
      el.removeEventListener('pointerdown', press)
      el.removeEventListener('pointerup', release)
      el.removeEventListener('pointercancel', release)
      el.removeEventListener('pointerleave', release)
    }
  }, [pad])
  const label = t(pad === 'drum' ? 'inst.drum' : 'inst.tamb')
  return (
    <div
      ref={ref}
      className={`pad pad-${pad}`}
      role="button"
      aria-label={label}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Art k={pad === 'drum' ? 'pad.drum' : 'pad.tamb'} className="pad-art" fallback={<span className="pad-ph" />} />
      <span className="pad-label">{label}</span>
    </div>
  )
}
