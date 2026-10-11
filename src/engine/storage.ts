// localStorage 薄包装：全部 try/catch，读不到就回传 null（当新玩家）。键自动加前缀。
import { STORAGE_PREFIX } from './config.ts'

export function loadRaw(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(STORAGE_PREFIX + key) ?? null
  } catch {
    return null
  }
}

export function saveRaw(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_PREFIX + key, value)
  } catch {
    // 私密模式／配额满：忽略
  }
}

export function loadNumber(key: string): number | null {
  const raw = loadRaw(key)
  if (raw === null) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}
