// 打中特效：粒子（8–14 颗）＋判定字从乐器垫上方弹出再淡出。完全用 DOM＋CSS 动画（transform／opacity），
// 不走 React state，打一下不会重绘画面。省电模式／系统「减少动态」：不放粒子（判定字只淡出）。
// 事件来源：game/fx.ts（useSession 转送 Session 的 onHit）。.stage 里放一个就好。
import { useEffect, useRef } from 'react'
import { onHit } from '../game/fx.ts'
import { t } from '../data/say.ts'
import type { Pad } from '../engine/config.ts'

const COLORS: Record<Pad, string[]> = {
  drum: ['#f28b82', '#f7b3ad', '#ffe2a8', '#ffffff'],
  tamb: ['#f4cf72', '#f9e3a1', '#ffd0b3', '#ffffff'],
}
const MAX_LIVE = 90

function particlesOn(): boolean {
  if (document.documentElement.dataset.powersave === 'on') return false
  try {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return true
  }
}

export default function Particles() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(
    () =>
      onHit((e) => {
        const root = ref.current
        if (!root || e.verdict === 'miss') return
        const padEl = root.parentElement?.querySelector<HTMLElement>(`.pad-${e.pad}`)
        if (!padEl) return
        const box = root.getBoundingClientRect()
        const r = padEl.getBoundingClientRect()
        const cx = r.left - box.left + r.width / 2
        const top = r.top - box.top + r.height * 0.12

        const word = document.createElement('span')
        word.className = `fx-word jd-${e.verdict}`
        word.textContent = t(`judge.${e.verdict}` as 'judge.perfect')
        word.style.left = `${cx}px`
        word.style.top = `${top}px`
        root.appendChild(word)
        const drop = (el: HTMLElement) => () => el.remove()
        word.addEventListener('animationend', drop(word), { once: true })
        window.setTimeout(drop(word), 1400)

        if (e.verdict === 'wrong' || !particlesOn() || root.childElementCount > MAX_LIVE) return
        const n = e.verdict === 'perfect' ? 14 : 8
        const colors = e.verdict === 'perfect' ? ['#f2a93b', ...COLORS[e.pad]] : COLORS[e.pad]
        for (let i = 0; i < n; i++) {
          const a = (-Math.PI / 2) + (Math.random() - 0.5) * Math.PI * 1.15 // 向上扇形
          const dist = r.width * (0.35 + Math.random() * 0.45)
          const p = document.createElement('i')
          p.className = i % 3 === 0 ? 'fx-dot fx-star' : 'fx-dot'
          p.style.left = `${cx}px`
          p.style.top = `${top + r.height * 0.1}px`
          p.style.setProperty('--dx', `${(Math.cos(a) * dist).toFixed(1)}px`)
          p.style.setProperty('--dy', `${(Math.sin(a) * dist).toFixed(1)}px`)
          p.style.setProperty('--s', (0.7 + Math.random() * 0.8).toFixed(2))
          p.style.setProperty('--r', `${Math.round((Math.random() - 0.5) * 200)}deg`)
          p.style.background = colors[i % colors.length]
          root.appendChild(p)
          p.addEventListener('animationend', drop(p), { once: true })
          window.setTimeout(drop(p), 1400)
        }
      }),
    [],
  )
  return <div ref={ref} className="fx-layer" aria-hidden="true" />
}
