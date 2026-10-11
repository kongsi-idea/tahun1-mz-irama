import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { getContext, unlock } from '../engine/clock.ts'
import { STAR_THRESHOLDS } from '../engine/config.ts'
import type { Pad } from '../engine/config.ts'
import { onInput } from '../engine/input.ts'
import { playPad } from '../engine/synth.ts'
import { setLearnDone } from '../data/progress.ts'
import { accentMask } from '../data/levels.ts'
import type { Cell } from '../data/levels.ts'
import { speak, t } from '../data/say.ts'
import type { SayKey } from '../data/say.ts'
import { useSession } from '../game/useSession.ts'
import { useCheer } from '../game/useCheer.ts'
import { autoTap, isAuto } from '../game/auto.ts'
import { comboTier, phaseLabel, poseFor } from '../game/labels.ts'
import type { RoundOutcome } from '../game/session.ts'
import type { RoundSpec } from '../game/timeline.ts'
import Stage from '../ui/Stage.tsx'
import Character from '../ui/Character.tsx'
import type { Pose } from '../ui/Character.tsx'
import IconTrack from '../ui/IconTrack.tsx'
import TopBar from '../ui/TopBar.tsx'
import type { Go } from './nav.ts'

// 学一学（规格 §3.2）五步，每步都要学生动手，没过不能跳（?skip=1 由 App 直接绕过整个学一学）：
//   1 听一听：两个垫子各点 2 下        2 分一分：听声音点对的乐器，答对 3 题
//   3 一颗草莓拍一下：4 拍都在「很好」以内（没过自动再来，不显示失败）
//   4 第一拍最重：跟着打 2 小节，≥ ★（60%）      5 小测验：2 题回声都 ≥ ★；没过回第 3 步
const D: Cell = 'drum'
const T: Cell = 'tamb'
const LEARN_BPM = 76

const STEP3: RoundSpec[] = [{ pattern: [D, D, D, D], bpm: LEARN_BPM, mode: 'follow' }]
const STEP4_PATTERN: Cell[] = [D, T, T, T, D, T, T, T]
const STEP4: RoundSpec[] = [
  { pattern: STEP4_PATTERN, bpm: LEARN_BPM, mode: 'follow', accent: accentMask(STEP4_PATTERN, 'first') },
]
const STEP5: RoundSpec[] = [
  { pattern: [D, D, T, T], bpm: LEARN_BPM, mode: 'echo' },
  { pattern: [D, T, D, T], bpm: LEARN_BPM, mode: 'echo' },
]

const allHit = (all: RoundOutcome[]) =>
  all.every((o) => o.judged.results.every((r) => r.verdict === 'perfect' || r.verdict === 'good'))
const allStar = (all: RoundOutcome[]) => all.every((o) => o.judged.accuracy >= STAR_THRESHOLDS[0])

interface StepProps {
  go: Go
  step: number
  notice: SayKey | null
  onNext: () => void
  onFail?: () => void
}

function Top({
  go,
  step,
  titleKey,
  sayKey,
  pose,
  tier = 0,
  line,
}: {
  go: Go
  step: number
  titleKey: SayKey
  sayKey: SayKey
  pose: Pose
  tier?: number
  line?: ReactNode
}) {
  return (
    <>
      <TopBar
        onBack={() => go({ name: 'home' })}
        right={
          <div className="step-dots" aria-label={t('learn.progress', { n: step })}>
            {[1, 2, 3, 4, 5].map((i) => (
              <i key={i} className={i === step ? 'on' : i < step ? 'past' : ''} />
            ))}
          </div>
        }
      />
      <div className="top-msg">
        <Character pose={pose} tier={tier} />
        <div className="bubble">
          <strong>{t(titleKey)}</strong>
          <span>{t(sayKey)}</span>
          {line}
        </div>
      </div>
    </>
  )
}

function PassBar({ onNext, last }: { onNext: () => void; last?: boolean }) {
  useEffect(() => {
    speak(last ? 'learn.all' : 'learn.pass')
  }, [last])
  useEffect(() => {
    if (!isAuto()) return
    const id = window.setTimeout(onNext, 900) // 机器人：过关后自己按「下一步」
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="track-panel pass-bar">
      <strong className="pass-text">{last ? t('learn.all') : t('learn.pass')}</strong>
      <button type="button" className="btn btn-coral" onClick={onNext}>
        {last ? t('learn.toMap') : t('learn.next')}
      </button>
    </div>
  )
}

function useTimeouts() {
  const ids = useRef<number[]>([])
  useEffect(() => () => ids.current.forEach((id) => clearTimeout(id)), [])
  return (fn: () => void, ms: number) => {
    ids.current.push(window.setTimeout(fn, ms))
  }
}

// ---------- 第 1 步：听一听 ----------
function Step1({ go, step, onNext }: StepProps) {
  const [count, setCount] = useState({ drum: 0, tamb: 0 })
  const [pose, setPose] = useState<Pose>('idle')
  const later = useTimeouts()
  useEffect(() => {
    speak('learn.1.say')
    if (isAuto()) (['drum', 'tamb', 'drum', 'tamb'] as Pad[]).forEach((p, i) => later(() => autoTap(p), 500 + i * 350))
    return onInput((e) => setCount((c) => ({ ...c, [e.pad]: c[e.pad] + 1 })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const hear = (pad: Pad) => {
    void unlock()
    playPad(pad, getContext().currentTime + 0.03)
    setPose(pad)
    later(() => setPose('idle'), 450)
  }
  const passed = count.drum >= 2 && count.tamb >= 2
  const chips = (pad: Pad) => (
    <span className="chips" aria-hidden="true">
      {[0, 1].map((i) => (
        <i key={i} className={count[pad] > i ? 'on' : ''} />
      ))}
    </span>
  )
  return (
    <Stage
      top={
        <Top
          go={go}
          step={step}
          titleKey="learn.1.title"
          sayKey="learn.1.say"
          pose={pose}
          line={<em>{t('learn.1.hint')}</em>}
        />
      }
      track={
        passed ? (
          <PassBar onNext={onNext} />
        ) : (
          <div className="track-panel">
            <div className="btn-row">
              <button type="button" className="btn btn-soft" onClick={() => hear('drum')}>
                {t('learn.1.hearDrum')}
              </button>
              <button type="button" className="btn btn-soft" onClick={() => hear('tamb')}>
                {t('learn.1.hearTamb')}
              </button>
            </div>
            <div className="chip-row">
              <span>{t('inst.drum')}</span>
              {chips('drum')}
              <span>{t('inst.tamb')}</span>
              {chips('tamb')}
            </div>
          </div>
        )
      }
    />
  )
}

// ---------- 第 2 步：分一分 ----------
const QUESTIONS: Pad[] = ['tamb', 'drum', 'tamb']

function Step2({ go, step, onNext }: StepProps) {
  const [correct, setCorrect] = useState(0)
  const [feedback, setFeedback] = useState<SayKey | null>(null)
  const [pose, setPose] = useState<Pose>('idle')
  const qRef = useRef(0)
  const lockRef = useRef(false)
  const later = useTimeouts()

  const ask = () => {
    const pad = QUESTIONS[qRef.current % QUESTIONS.length]
    playPad(pad, getContext().currentTime + 0.03)
    setPose(pad)
    later(() => setPose('idle'), 450)
    if (isAuto()) later(() => autoTap(pad), 900) // 机器人：听完就答对
  }

  useEffect(() => {
    speak('learn.2.say')
    later(ask, 700)
    return onInput((e) => {
      if (lockRef.current || qRef.current >= QUESTIONS.length) return
      if (e.pad === QUESTIONS[qRef.current]) {
        lockRef.current = true
        qRef.current++
        setCorrect(qRef.current)
        setFeedback('learn.2.right')
        speak('learn.2.right')
        setPose('happy')
        later(() => {
          lockRef.current = false
          setFeedback(null)
          setPose('idle')
          if (qRef.current < QUESTIONS.length) ask()
        }, 1000)
      } else {
        setFeedback('learn.2.wrong')
        speak('learn.2.wrong')
        later(() => {
          setFeedback(null)
          ask()
        }, 800)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const passed = correct >= QUESTIONS.length
  return (
    <Stage
      top={<Top go={go} step={step} titleKey="learn.2.title" sayKey="learn.2.say" pose={pose} />}
      track={
        passed ? (
          <PassBar onNext={onNext} />
        ) : (
          <div className="track-panel">
            <div className="chip-row">
              {QUESTIONS.map((_, i) => (
                <i key={i} className={`chip-dot${correct > i ? ' on' : ''}`} />
              ))}
            </div>
            <p className="feedback">{feedback ? t(feedback) : ' '}</p>
            <button type="button" className="btn btn-soft" onClick={ask}>
              {t('learn.2.replay')}
            </button>
          </div>
        )
      }
    />
  )
}

// ---------- 第 3、4、5 步：跟着打／回声 ----------
function RhythmStep({
  go,
  step,
  notice,
  onNext,
  onFail,
  titleKey,
  sayKey,
  specs,
  backing,
  ok,
  last,
}: StepProps & {
  titleKey: SayKey
  sayKey: SayKey
  specs: RoundSpec[]
  backing: 1 | null
  ok: (all: RoundOutcome[]) => boolean
  last?: boolean
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const { view, start } = useSession(rootRef)
  const { cheer, onHit } = useCheer()
  const [state, setState] = useState<'intro' | 'running' | 'retry' | 'pass'>('intro')
  const later = useTimeouts()
  const mode = specs[0].mode

  useEffect(() => {
    speak(notice ?? sayKey)
  }, [sayKey, notice])
  useEffect(() => {
    if (state === 'retry') speak('learn.retry')
  }, [state])
  const label = phaseLabel(view, mode)
  useEffect(() => {
    if (label) speak(label)
  }, [label])

  const begin = () => {
    void unlock()
    setState('running')
    start(
      {
      rounds: specs,
      backing,
      onHit,
      onDone: (all) => {
        if (ok(all)) setState('pass')
        else {
          setState('retry')
          later(() => {
            if (onFail) onFail()
            else begin()
          }, 1700)
        }
      },
    },
      { ignoreMiss: true }, // ?auto=miss 也要走得完学一学
    )
  }
  useEffect(() => {
    // 机器人：进到这一步就自己按「开始」
    if (!isAuto() || state !== 'intro') return
    const id = window.setTimeout(begin, 600)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const first = specs[0]
  const cells = view?.cells ?? first.pattern
  const accent = view?.accent ?? first.accent ?? []
  const hideAhead = !!view && mode === 'echo' && view.phase === 'demo'
  const hideAll = !!view && mode === 'echo' && view.phase === 'lead'

  const track =
    state === 'pass' ? (
      <PassBar onNext={onNext} last={last} />
    ) : (
      <div className="track-panel">
        <IconTrack
          cells={cells}
          accent={accent}
          verdicts={view?.verdicts}
          cursor={view?.cursor}
          cueing={view?.cueing}
          hideAhead={hideAhead}
          hideAll={hideAll}
        />
      </div>
    )

  return (
    <Stage
      ref={rootRef}
      combo={view?.combo ?? 0}
      top={
        <Top
          go={go}
          step={step}
          titleKey={titleKey}
          sayKey={notice && state === 'intro' ? notice : sayKey}
          pose={cheer ? 'cheer' : poseFor(view)}
          tier={comboTier(view?.combo ?? 0)}
          line={
            state === 'intro' ? (
              <div className="bubble-actions">
                <button type="button" className="btn btn-coral btn-sm" onClick={begin}>
                  {t('learn.go')}
                </button>
              </div>
            ) : (
              <p className="phase-label">{state === 'retry' ? t('learn.retry') : label ? t(label) : '\u00a0'}</p>
            )
          }
        />
      }
      track={track}
    />
  )
}

export default function Learn({ go }: { go: Go }) {
  const [step, setStep] = useState(1)
  const [notice, setNotice] = useState<SayKey | null>(null)

  const onNext = () => {
    setNotice(null)
    if (step >= 5) {
      setLearnDone()
      go({ name: 'map' })
    } else setStep(step + 1)
  }
  const common = { go, step, notice, onNext }

  let body: ReactNode
  if (step === 1) body = <Step1 key={1} {...common} />
  else if (step === 2) body = <Step2 key={2} {...common} />
  else if (step === 3)
    body = (
      <RhythmStep
        key={3}
        {...common}
        titleKey="learn.3.title"
        sayKey="learn.3.say"
        specs={STEP3}
        backing={null}
        ok={allHit}
      />
    )
  else if (step === 4)
    body = (
      <RhythmStep
        key={4}
        {...common}
        titleKey="learn.4.title"
        sayKey="learn.4.say"
        specs={STEP4}
        backing={null}
        ok={allStar}
      />
    )
  else
    body = (
      <RhythmStep
        key={5}
        {...common}
        titleKey="learn.5.title"
        sayKey="learn.5.say"
        specs={STEP5}
        backing={1}
        ok={allStar}
        last
        onFail={() => {
          setNotice('learn.5.back')
          setStep(3)
        }}
      />
    )
  return <main className="screen screen-stage">{body}</main>
}
