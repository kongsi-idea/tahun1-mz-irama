import { useEffect, useRef } from 'react'
import { bindPad, onInput } from '../engine/input.ts'
import type { Pad } from '../engine/config.ts'

// 试听／debug 页用的乐器垫：pointerdown 即响（不用 click），键盘触发时也会闪一下。
export default function PadButton({ pad, label, size = 140 }: { pad: Pad; label: string; size?: number }) {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const unbind = bindPad(el, pad)
    const unsub = onInput((e) => {
      if (e.pad === pad && e.source === 'key') {
        el.classList.add('flash')
        setTimeout(() => el.classList.remove('flash'), 120)
      }
    })
    return () => {
      unbind()
      unsub()
    }
  }, [pad])
  return (
    <button
      ref={ref}
      type="button"
      className={`dev-pad pad-${pad}`}
      style={{ width: size, height: size }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  )
}
