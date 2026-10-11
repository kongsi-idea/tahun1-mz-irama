import { useEffect, useRef, useState } from 'react'
import './dev.css'
import { t } from '../data/say.ts'
import PadButton from './PadButton.tsx'
import { Scheduler } from '../engine/scheduler.ts'
import { attachBacking } from '../engine/backing.ts'
import type { BackingHandle } from '../engine/backing.ts'
import { getContext, heardTime, perfToAudio, unlock } from '../engine/clock.ts'
import { bindKeyboard } from '../engine/input.ts'
import { click, initSynth } from '../engine/synth.ts'
import { getBaseMs, getOffsetMs, hasCalibration, runCalibration } from '../engine/calibrate.ts'
import type { CalibrationResult } from '../engine/calibrate.ts'
import { getAvgFrameMs, isPowerSave, onPowerSaveChange, setPowerSave, startFrameMonitor, stopFrameMonitor } from '../engine/perf.ts'

const DEBUG_BPM = 90
const WINDOW = 20

interface DriftStats {
  last: number
  maxLateness: number // 拍点被 rAF 看到时的迟到量（含最多一帧的取样误差）
  maxDrift: number // 最近 20 拍平均迟到量，减去最初 20 拍的平均
  beats: number
}

interface Snapshot {
  offset: number
  base: number
  calibrated: boolean
  avgFrame: number
  powerSave: boolean
  outLatency: string
  baseLatency: string
  drift: DriftStats
  errors: string
  calMsg: string
}

const emptyDrift = (): DriftStats => ({ last: 0, maxLateness: 0, maxDrift: 0, beats: 0 })

// ?debug=1：显示偏移、误差、帧时间、省电状态、节拍漂移、outputLatency。纯功能。
export default function Debug() {
  const sched = useRef<Scheduler | null>(null)
  const backing = useRef<BackingHandle | null>(null)
  const pendingBeats = useRef<number[]>([])
  const drift = useRef<DriftStats>(emptyDrift())
  const lateness = useRef<number[]>([])
  const baseline = useRef<number | null>(null)
  const [running, setRunning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState('（还没做过校准）')
  const [calMsg, setCalMsg] = useState('')
  const [, setPs] = useState(isPowerSave())
  const [snap, setSnap] = useState<Snapshot | null>(null)

  useEffect(() => bindKeyboard(window), [])
  useEffect(() => onPowerSaveChange((v) => setPs(v)), [])

  // 帧循环：量帧时间 + 量节拍漂移
  useEffect(() => {
    startFrameMonitor()
    let raf = 0
    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop)
      const q = pendingBeats.current
      if (q.length === 0 || !sched.current) return
      const c = getContext()
      // rAF 时间戳换成 audio 时间，再扣输出延迟＝画面「该看到」的听觉时间
      const heardAtFrame = perfToAudio(ts) - (c.outputLatency ?? c.baseLatency ?? 0)
      while (q.length && q[0] <= heardAtFrame) {
        const late = (heardAtFrame - q.shift()!) * 1000
        const d = drift.current
        d.last = late
        d.beats++
        d.maxLateness = Math.max(d.maxLateness, late)
        const arr = lateness.current
        arr.push(late)
        if (arr.length > WINDOW) arr.shift()
        if (baseline.current === null && arr.length === WINDOW) baseline.current = arr.reduce((a, b) => a + b, 0) / WINDOW
        if (baseline.current !== null && arr.length === WINDOW) {
          const mean = arr.reduce((a, b) => a + b, 0) / WINDOW
          d.maxDrift = Math.max(d.maxDrift, Math.abs(mean - baseline.current))
        }
      }
    }
    raf = requestAnimationFrame(loop)
    const timer = setInterval(() => {
      let outL = '（尚未启动）'
      let baseL = outL
      try {
        const c = getContext()
        outL = c.outputLatency === undefined ? '浏览器不提供' : `${(c.outputLatency * 1000).toFixed(1)} ms`
        baseL = `${(c.baseLatency * 1000).toFixed(1)} ms`
        void heardTime()
      } catch {
        // 还没有 AudioContext
      }
      setSnap({
        offset: getOffsetMs(),
        base: getBaseMs(),
        calibrated: hasCalibration(),
        avgFrame: getAvgFrameMs(),
        powerSave: isPowerSave(),
        outLatency: outL,
        baseLatency: baseL,
        drift: { ...drift.current },
        errors: '',
        calMsg: '',
      })
    }, 250)
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(timer)
      stopFrameMonitor()
    }
  }, [])

  const stopBacking = () => {
    sched.current?.stop()
    backing.current?.detach()
    sched.current = null
    backing.current = null
    pendingBeats.current = []
    setRunning(false)
  }
  useEffect(() => stopBacking, [])

  const toggleBacking = () => {
    void unlock()
    initSynth()
    if (running) return stopBacking()
    const s = new Scheduler({ tempoMap: [{ beat: 0, bpm: DEBUG_BPM }] })
    sched.current = s
    backing.current = attachBacking(s, 1)
    drift.current = emptyDrift()
    lateness.current = []
    baseline.current = null
    s.subscribe((t) => {
      if (!t.isBeat) return
      click(t.time, t.beatInBar === 0)
      pendingBeats.current.push(t.time)
    })
    s.start()
    setRunning(true)
  }

  const calibrate = async () => {
    if (running) stopBacking()
    setBusy(true)
    setCalMsg('跟着节拍器拍 8 下（点下面的垫子，或按 F／J）……')
    try {
      const r: CalibrationResult = await runCalibration()
      setErrors(r.errorsMs.map((e) => (e === null ? '—' : e.toFixed(0))).join(', ') + ' ms')
      setCalMsg(r.ok ? `完成：偏移 ${r.offsetMs!.toFixed(1)} ms（后 6 下有效 ${r.usedHits} 下）` : `无效：后 6 下只打到 ${r.usedHits} 下，请再试一次`)
    } finally {
      setBusy(false)
    }
  }

  const s = snap
  const f = (n: number, d = 1) => n.toFixed(d)
  return (
    <main className="dev">
      <h1>Debug</h1>
      <p className="lead">?debug=1 · 引擎量测</p>
      <section>
        <h2>操作</h2>
        <div className="row">
          <button type="button" className={`dev-btn${running ? ' on' : ''}`} onClick={toggleBacking} disabled={busy}>
            {running ? '停止伴奏' : `开始伴奏（${DEBUG_BPM} BPM）`}
          </button>
          <button type="button" className="dev-btn" onClick={calibrate} disabled={busy}>
            校准一次
          </button>
          <button type="button" className="dev-btn" onClick={() => setPowerSave(!isPowerSave())}>
            省电模式：{s?.powerSave ? '开' : '关'}
          </button>
        </div>
        <div className="row pads" style={{ marginTop: 'var(--space-3)' }}>
          <PadButton pad="drum" label={t('inst.drum')} size={110} />
          <PadButton pad="tamb" label={t('inst.tamb')} size={110} />
        </div>
        <p className="note" style={{ textAlign: 'center', marginTop: 'var(--space-3)' }}>{calMsg}</p>
      </section>
      <section>
        <h2>数值</h2>
        <table>
          <tbody>
            <tr><th>当前偏移</th><td>{s ? `${f(s.offset)} ms${s.calibrated ? `（校准值 ${f(s.base)}）` : '（未校准）'}` : '—'}</td></tr>
            <tr><th>上一轮误差（逐拍）</th><td>{errors}</td></tr>
            <tr><th>平均帧时间</th><td>{s ? `${f(s.avgFrame)} ms` : '—'}</td></tr>
            <tr><th>省电状态</th><td>{s ? (s.powerSave ? '已开启' : '关闭') : '—'}</td></tr>
            <tr><th>节拍漂移（最大，趋势）</th><td>{s ? `${f(s.drift.maxDrift)} ms` : '—'}</td></tr>
            <tr><th>节拍迟到（最近 / 最大）</th><td>{s ? `${f(s.drift.last)} / ${f(s.drift.maxLateness)} ms · ${s.drift.beats} 拍` : '—'}</td></tr>
            <tr><th>outputLatency</th><td>{s?.outLatency ?? '—'}</td></tr>
            <tr><th>baseLatency</th><td>{s?.baseLatency ?? '—'}</td></tr>
          </tbody>
        </table>
        <p className="note" style={{ marginTop: 'var(--space-3)' }}>
          节拍迟到＝排程拍点 vs rAF 帧（换算成听到的时间）首次越过它时的差，包含最多一帧的取样误差；漂移＝最近 20 拍的平均迟到，减去最初 20 拍的平均，越稳定越接近 0。
        </p>
      </section>
    </main>
  )
}
