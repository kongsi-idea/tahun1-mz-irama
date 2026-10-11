import { useState } from 'react'
import type { ReactNode } from 'react'
import { ASSETS } from '../data/assets.ts'
import type { AssetKey } from '../data/assets.ts'

// 取图：assets.ts 没填路径、或档案读不到，就显示 fallback 占位。
export default function Art({
  k,
  className,
  fallback,
}: {
  k: AssetKey
  className?: string
  fallback?: ReactNode
}) {
  const src = ASSETS[k]
  const [bad, setBad] = useState(false)
  if (!src || bad) return <>{fallback ?? null}</>
  return <img className={className} src={src} alt="" draggable={false} onError={() => setBad(true)} />
}
