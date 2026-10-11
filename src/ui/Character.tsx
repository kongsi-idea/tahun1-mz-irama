import { useEffect } from 'react'
import Art from './Art.tsx'
import { ASSETS } from '../data/assets.ts'
import type { AssetKey } from '../data/assets.ts'
import { getHero } from '../data/progress.ts'

export type Pose = 'idle' | 'drum' | 'tamb' | 'happy' | 'spin' | 'cheer'

const BEAR_KEYS: AssetKey[] = ['bear.idle', 'bear.drum', 'bear.tamb', 'bear.happy', 'bear.spin', 'bear.cheer']
let preloaded = false
// 换姿势时图片要已经在快取里，不然会闪一下空白。
function preload(): void {
  if (preloaded) return
  preloaded = true
  for (const k of BEAR_KEYS) {
    const src = ASSETS[k]
    if (src) new Image().src = src
  }
}

// 主角：果冻熊（5 个姿势换图）或学生选的朋友（只有一张图，用 CSS 做跳／摇／转，见 app.css）。
// data-pose（动作）、data-tier（连击等级 0~3：5／10／20 升级）、跟拍脉动吃父层 --pulse。
// hero＝false 时固定画果冻熊（例如声音检查）。
export default function Character({ pose = 'idle', tier = 0, hero = true }: { pose?: Pose; tier?: number; hero?: boolean }) {
  useEffect(preload, [])
  const friend = hero ? getHero() : 0
  return (
    <div className="bear" data-pose={pose} data-tier={tier} data-friend={friend || undefined} aria-hidden="true">
      {friend ? (
        <Art
          k={`friend.${friend}` as AssetKey}
          className="bear-art friend-art"
          fallback={
            <div className="bear-ph">
              <span>友</span>
            </div>
          }
        />
      ) : (
        <Art
          k={`bear.${pose}` as AssetKey}
          className="bear-art"
          fallback={
            <div className="bear-ph">
              <span>熊</span>
            </div>
          }
        />
      )}
    </div>
  )
}
