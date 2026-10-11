// 画面流程（规格 §3.1）。没有路由套件：App 持有目前的 Route，各画面用 go() 转场。
import type { Best } from '../data/progress.ts'

export interface PlayResult {
  levelId: string
  stars: 0 | 1 | 2 | 3
  accuracy: number
  perfect: number
  good: number
  miss: number
  wrong: number
  extra: number
  bestCombo: number
  /** 这次之前的个人最佳（第一次玩＝null） */
  prev: Best | null
  /** 存档后的个人最佳 */
  best: Best
  newRecord: boolean
  /** 这次新解锁的朋友（friend.N 的 N）；没有就是空阵列 */
  unlocked: number[]
  /** 世界 6 也满星＝全部解锁的小庆祝 */
  unlockedAll: boolean
}

export type Route =
  | { name: 'home' }
  | { name: 'soundcheck'; next: Route }
  | { name: 'learn' }
  | { name: 'map' }
  | { name: 'play'; levelId: string; nonce: number }
  | { name: 'result'; result: PlayResult }
  | { name: 'settings' }

export type Go = (r: Route) => void
