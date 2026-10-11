import { useEffect, useRef, useState } from 'react'
import { unlock } from '../engine/clock.ts'
import { onInput } from '../engine/input.ts'
import { initSynth } from '../engine/synth.ts'
import { CAL_BEATS } from '../engine/config.ts'
import { runCalibration, setCalibration } from '../engine/calibrate.ts'
import { isSkipMode } from '../data/progress.ts'
import { autoTap, isAuto } from '../game/auto.ts'
import { speak, t } from '../data/say.ts'
import Stage from '../ui/Stage.tsx'
import Character from '../ui/Character.tsx'
import TopBar from '../ui/TopBar.tsx'
import type { Go, Route } from './nav.ts'

type Phase = 'test' | 'intro' | 'running' | 'ok' | 'retry'

// 声音检查＋首次 8 拍校准。第一次点击里 unlock()（点垫子本身也会 unlock）。
export default function SoundCheck({ go, next }: { go: Go; next: Route }) {
  const [phase, setPhase] = useState<Phase>('test')
  const [taps, setTaps] = useState(0)
  const [beat, setBeat] = useState(-1)
  const [fails, setFails] = useState(0)
  const [shaky, setShaky] = useState(false)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    void unlock()
    initSynth()
    speak('sc.tip')
    const off = onInput(() => setTaps((n) => n + 1))
    return () => {
      alive.current = false
      off()
    }
  }, [])

  const startCal = async () => {
    void unlock()
    setPhase('running')
    setBeat(-1)
    const res = await runCalibration((i) => {
      if (!alive.current) return
      setBeat(i)
      if (isAuto()) autoTap('drum', true) // 机器人：每拍点一下（?late= 会让它整体晚一点，校准就量到那个延迟）
    })
    if (!alive.current) return
    setShaky(res.shaky)
    if (res.ok) setPhase('ok')
    else {
      setFails((n) => n + 1)
      setPhase('retry')
    }
  }

  // 反复失败（可能静音）时，允许用预设偏移 0 先跳过，避免卡死；老师的 ?skip=1 也随时可跳。
  const skip = () => {
    setCalibration(0)
    go(next)
  }
  // 机器人：自己点垫子、按「听到了」「开始」「下一步」（?auto=miss 在这里也照常点，不然校准会失败卡住）
  useEffect(() => {
    if (!isAuto()) return
    const id = window.setTimeout(
      () => {
        if (phase === 'test') {
          autoTap('drum')
          window.setTimeout(() => alive.current && setPhase('intro'), 300)
        } else if (phase === 'intro') void startCal()
        else if (phase === 'ok') go(next)
        else if (phase === 'retry') void startCal()
      },
      phase === 'test' ? 500 : 600,
    )
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])
  const canSkip = fails >= 2 || isSkipMode()

  useEffect(() => {
    if (phase === 'intro') speak('sc.cal.intro')
    else if (phase === 'ok') speak(shaky ? 'sc.cal.shaky' : 'sc.cal.ok')
    else if (phase === 'retry') speak('sc.cal.retry')
  }, [phase, shaky])

  const message =
    phase === 'test'
      ? t('sc.test')
      : phase === 'intro'
        ? t('sc.cal.intro')
        : phase === 'running'
          ? t('sc.cal.running')
          : phase === 'ok'
            ? t(shaky ? 'sc.cal.shaky' : 'sc.cal.ok')
            : t('sc.cal.retry')

  const top = (
    <>
      <TopBar onBack={() => go({ name: 'home' })} />
      <div className="top-msg">
        <Character pose={phase === 'ok' ? 'happy' : 'idle'} hero={false} />
        <div className="bubble">
          <strong>{phase === 'test' ? t('sc.title') : t('sc.cal.title')}</strong>
          <span>{message}</span>
          {phase === 'test' && <em className="tip">{t('sc.tip')}</em>}
        </div>
      </div>
    </>
  )

  const track = (
    <div className="track-panel">
      {(phase === 'intro' || phase === 'running' || phase === 'ok' || phase === 'retry') && (
        <div className="cal-dots" aria-hidden="true">
          {Array.from({ length: CAL_BEATS }, (_, i) => (
            <i key={i} className={beat === i ? 'on' : beat > i ? 'past' : ''} />
          ))}
        </div>
      )}
      {phase === 'test' && (
        <button type="button" className="btn btn-coral" disabled={taps < 1} onClick={() => setPhase('intro')}>
          {t('sc.heard')}
        </button>
      )}
      {phase === 'intro' && (
        <button type="button" className="btn btn-coral" onClick={startCal}>
          {t('sc.cal.go')}
        </button>
      )}
      {phase === 'ok' && (
        <div className="btn-row">
          <button type="button" className={`btn ${shaky ? 'btn-coral' : 'btn-soft'}`} onClick={startCal}>
            {t('sc.cal.again')}
          </button>
          <button type="button" className={`btn ${shaky ? 'btn-soft' : 'btn-coral'}`} onClick={() => go(next)}>
            {t('sc.next')}
          </button>
        </div>
      )}
      {phase === 'retry' && (
        <div className="btn-row">
          <button type="button" className="btn btn-coral" onClick={startCal}>
            {t('sc.cal.again')}
          </button>
        </div>
      )}
      {canSkip && phase !== 'running' && phase !== 'ok' && (
        <button type="button" className="link-btn" onClick={skip}>
          {t('sc.skip')}
        </button>
      )}
    </div>
  )

  return (
    <main className="screen screen-stage">
      <Stage top={top} track={track} />
    </main>
  )
}
