import { useCallback, useEffect, useRef, useState } from 'react'
import type { HitEvent } from './session.ts'

const CHEER_MS = 900

/** 漏掉时熊换 bear.cheer 鼓励一下（约 0.9 秒）。onHit 交给 start({ onHit })。 */
export function useCheer(): { cheer: boolean; onHit: (e: HitEvent) => void } {
  const [cheer, setCheer] = useState(false)
  const timer = useRef(0)
  const onHit = useCallback((e: HitEvent) => {
    if (e.verdict !== 'miss') return
    setCheer(true)
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCheer(false), CHEER_MS)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  return { cheer, onHit }
}
