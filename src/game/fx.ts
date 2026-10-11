// 画面特效的小广播：useSession 把 Session 的「当下打中」事件转到这里，Particles（粒子＋判定字）订阅。
// 不走 React state，打一下不会重绘整个画面。
import type { HitEvent } from './session.ts'

type Listener = (e: HitEvent) => void
const listeners = new Set<Listener>()

export function onHit(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function emitHit(e: HitEvent): void {
  for (const fn of listeners) fn(e)
}
