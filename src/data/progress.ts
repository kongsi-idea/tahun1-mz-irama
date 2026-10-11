// 进度储存（规格 §2.7）：旧存档里已不存在的关卡 id（如 '1-4'、'1-5'）不会被读到，也不报错，直接忽略。
// 每关最佳星数＋最佳准确度、学一学是否通过、设定。全走 engine/storage.ts（try/catch，读不到＝新玩家）。
import { loadRaw, saveRaw } from '../engine/storage.ts'
import { LEVELS_PER_WORLD, LEVEL_ORDER, prevLevelId } from './levels.ts'

export interface Best {
  stars: number
  acc: number
}

/** ?skip=1：老师用，跳过学一学并解锁全部关卡。只在记忆体里生效，不写入储存。 */
export function isSkipMode(): boolean {
  try {
    return new URLSearchParams(globalThis.location?.search ?? '').get('skip') === '1'
  } catch {
    return false
  }
}

export function getBest(id: string): Best | null {
  const raw = loadRaw(`best:${id}`)
  if (!raw) return null
  try {
    const o = JSON.parse(raw) as Partial<Best>
    if (typeof o.stars === 'number' && typeof o.acc === 'number') return { stars: o.stars, acc: o.acc }
  } catch {
    // 坏资料当没有
  }
  return null
}

export interface SaveResult {
  prev: Best | null
  best: Best
  /** 准确度刷新了个人最佳（第一次玩不算「新纪录」） */
  newRecord: boolean
}

export function saveBest(id: string, stars: number, acc: number): SaveResult {
  const prev = getBest(id)
  const best: Best = { stars: Math.max(stars, prev?.stars ?? 0), acc: Math.max(acc, prev?.acc ?? 0) }
  saveRaw(`best:${id}`, JSON.stringify(best))
  return { prev, best, newRecord: prev !== null && acc > prev.acc + 1e-9 }
}

export function starsOf(id: string): number {
  return getBest(id)?.stars ?? 0
}

export function worldStars(world: number): number {
  let n = 0
  for (let i = 1; i <= LEVELS_PER_WORLD; i++) n += starsOf(`${world}-${i}`)
  return n
}

/** 纯函数：★ 就解锁下一关。第一关永远开着；skip＝全开。 */
export function isUnlockedWith(id: string, starsFn: (id: string) => number, all: boolean): boolean {
  if (all) return LEVEL_ORDER.includes(id)
  const prev = prevLevelId(id)
  if (prev === null) return LEVEL_ORDER.includes(id)
  return starsFn(prev) >= 1
}

export function isUnlocked(id: string): boolean {
  return isUnlockedWith(id, starsOf, isSkipMode())
}

export function isLearnDone(): boolean {
  return isSkipMode() || loadRaw('learn-done') === '1'
}
export function setLearnDone(): void {
  saveRaw('learn-done', '1')
}

export interface Settings {
  volume: number
}

export function loadSettings(): Settings {
  const raw = loadRaw('settings')
  if (raw) {
    try {
      const o = JSON.parse(raw) as Partial<Settings>
      if (typeof o.volume === 'number' && o.volume >= 0 && o.volume <= 1) return { volume: o.volume }
    } catch {
      // 用预设
    }
  }
  return { volume: 1 }
}
export function saveSettings(s: Settings): void {
  saveRaw('settings', JSON.stringify(s))
}

// ---------- 解锁乐手（规格 §3.5）----------
// 某世界 3 关都拿 ★★★ → 解锁 friend.N（世界 1→1 … 世界 5→5）。世界 6 全满＝「全部解锁」庆祝（没有第 6 位朋友）。
// 解锁状态不另存：直接由各关最佳星数推算，所以清存档＝重置，也不会和星数对不上。

export const FRIEND_COUNT = 5

/** 世界 w 的 3 关是否都拿了 ★★★。 */
export function worldCleared(world: number, starsFn: (id: string) => number = starsOf): boolean {
  for (let i = 1; i <= LEVELS_PER_WORLD; i++) if (starsFn(`${world}-${i}`) < 3) return false
  return true
}

/** 已满星的世界清单（1~6）。 */
export function clearedWorlds(starsFn: (id: string) => number = starsOf): number[] {
  const out: number[] = []
  for (let w = 1; w <= 6; w++) if (worldCleared(w, starsFn)) out.push(w)
  return out
}

/** ?friends=all：验收用，把 5 位朋友全部视为已解锁（只在记忆体，不写存档）。 */
function allFriendsDebug(): boolean {
  try {
    return new URLSearchParams(globalThis.location?.search ?? '').get('friends') === 'all'
  } catch {
    return false
  }
}

export function isFriendUnlocked(n: number): boolean {
  if (n < 1 || n > FRIEND_COUNT) return false
  return allFriendsDebug() || worldCleared(n)
}

export function unlockedFriends(): number[] {
  return Array.from({ length: FRIEND_COUNT }, (_, i) => i + 1).filter(isFriendUnlocked)
}

/** 目前的主角：0＝果冻熊，1~5＝friend.N。存的是选择；没解锁（或存档被清）就退回熊。 */
export function getHero(): number {
  const n = Number(loadRaw('hero'))
  return Number.isInteger(n) && isFriendUnlocked(n) ? n : 0
}
export function setHero(n: number): void {
  saveRaw('hero', String(n === 0 || isFriendUnlocked(n) ? n : 0))
}
