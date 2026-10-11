// 效能量测：rAF 帧时间。开局 2 秒平均 >20ms → 自动省电（关粒子、视差、光晕）。也可手动切换，手动值存 localStorage 并优先。
import { PERF_IGNORE_FRAME_MS, PERF_SLOW_FRAME_MS, PERF_WINDOW_MS } from './config.ts'
import { loadRaw, saveRaw } from './storage.ts'

export type PowerSaveReason = 'auto' | 'manual'
type Listener = (powerSave: boolean, reason: PowerSaveReason) => void

const RING = 120
const frames: number[] = []
const listeners = new Set<Listener>()
let powerSave = false
let manualSet = false
let rafId = 0
let last = 0
let startedAt = 0
let sum = 0
let count = 0
let decided = false

/** 纯函数：开局平均帧时间是否该自动省电。 */
export function shouldAutoSave(avgFrameMs: number): boolean {
  return avgFrameMs > PERF_SLOW_FRAME_MS
}

function loadManual(): void {
  const raw = loadRaw('powersave')
  if (raw === 'on' || raw === 'off') {
    manualSet = true
    powerSave = raw === 'on'
  }
}
loadManual()

function emit(reason: PowerSaveReason): void {
  for (const fn of listeners) fn(powerSave, reason)
}

export function isPowerSave(): boolean {
  return powerSave
}
export function onPowerSaveChange(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** 手动切换（设定页）。之后不再被自动判断覆盖。 */
export function setPowerSave(on: boolean): void {
  manualSet = true
  powerSave = on
  saveRaw('powersave', on ? 'on' : 'off')
  emit('manual')
}

/** 最近 ~120 帧的平均帧时间（毫秒）。 */
export function getAvgFrameMs(): number {
  if (frames.length === 0) return 0
  let s = 0
  for (const f of frames) s += f
  return s / frames.length
}

function loop(ts: number): void {
  rafId = requestAnimationFrame(loop)
  if (last) {
    const dt = ts - last
    if (dt < PERF_IGNORE_FRAME_MS) {
      frames.push(dt)
      if (frames.length > RING) frames.shift()
      if (!decided) {
        sum += dt
        count++
      }
    }
  }
  last = ts
  if (!decided && ts - startedAt >= PERF_WINDOW_MS && count > 0) {
    decided = true
    if (!manualSet && shouldAutoSave(sum / count) && !powerSave) {
      powerSave = true
      emit('auto')
    }
  }
}

/** 开始量测（画面开局时呼叫一次）。重复呼叫会重新做 2 秒的开局判断。 */
export function startFrameMonitor(): void {
  stopFrameMonitor()
  frames.length = 0
  sum = 0
  count = 0
  decided = false
  last = 0
  startedAt = performance.now()
  rafId = requestAnimationFrame(loop)
}

export function stopFrameMonitor(): void {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = 0
}
