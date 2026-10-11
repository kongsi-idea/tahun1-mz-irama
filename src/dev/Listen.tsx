import { useCallback, useEffect, useRef, useState } from 'react'
import './dev.css'
import { t } from '../data/say.ts'
import PadButton from './PadButton.tsx'
import { Scheduler } from '../engine/scheduler.ts'
import { BACKING_INFO, attachBacking } from '../engine/backing.ts'
import type { BackingStyle } from '../engine/backing.ts'
import type { BackingHandle } from '../engine/backing.ts'
import { bindKeyboard } from '../engine/input.ts'
import { click, drum, initSynth, tamb } from '../engine/synth.ts'
import { unlock } from '../engine/clock.ts'
import { BEATS_PER_BAR } from '../engine/config.ts'

type Mode = 'metro' | 'b1' | 'b2' | 'b3' | 'b4' | 'b5' | 'b6' | 'echo' | null
const BPMS = [70, 85, 100, 110]
const ECHO_PATTERN = ['drum', 'tamb', 'tamb', 'tamb'] as const
const ECHO_PREP_BARS = 2
const ECHO_ROUNDS = 2
const ECHO_TOTAL_BARS = ECHO_PREP_BARS + ECHO_ROUNDS * 2

interface View {
  beat: number // 0~3，-1＝没有
  text: string
  me: boolean
}
const IDLE: View = { beat: -1, text: '', me: false }

// 试听页：给老师听声音用。鼓、三角铁大垫、节拍器、两种伴奏、回声示范。
export default function Listen() {
  const [mode, setMode] = useState<Mode>(null)
  const [bpm, setBpm] = useState(85)
  const [view, setView] = useState<View>(IDLE)
  const sched = useRef<Scheduler | null>(null)
  const backing = useRef<BackingHandle | null>(null)
  const bpmRef = useRef(bpm)
  const modeRef = useRef<Mode>(null)

  useEffect(() => bindKeyboard(window), [])

  const stop = useCallback(() => {
    sched.current?.stop()
    backing.current?.detach()
    sched.current = null
    backing.current = null
    modeRef.current = null
    setMode(null)
    setView(IDLE)
  }, [])

  useEffect(() => stop, [stop])

  const start = useCallback(
    (next: Exclude<Mode, null>) => {
      void unlock()
      initSynth()
      const wasMode = modeRef.current
      stop()
      if (wasMode === next) return // 再按一次＝停止
      const s = new Scheduler({ tempoMap: [{ beat: 0, bpm: bpmRef.current }] })
      sched.current = s
      modeRef.current = next
      setMode(next)
      if (next === 'metro') {
        s.subscribe((t) => {
          if (t.isBeat) click(t.time, t.beatInBar === 0)
        })
      } else if (next !== 'echo') {
        backing.current = attachBacking(s, Number(next.slice(1)) as BackingStyle)
      } else {
        backing.current = attachBacking(s, 1, { noMel: true })
        s.subscribe((t) => {
          if (t.bar >= ECHO_TOTAL_BARS) {
            if (t.tick === ECHO_TOTAL_BARS * 8) queueMicrotask(stop)
            return
          }
          if (!t.isBeat) return
          const accent = t.beatInBar === 0
          const demo = t.bar >= ECHO_PREP_BARS && (t.bar - ECHO_PREP_BARS) % 2 === 0
          if (t.bar < ECHO_PREP_BARS || !demo) click(t.time, accent)
          else (ECHO_PATTERN[t.beatInBar] === 'drum' ? drum : tamb)(t.time, accent ? 1 : 0.85)
        })
      }
      s.start()
    },
    [stop],
  )

  // 画面从「听到的时间」算：跟着拍子点亮圆点、换提示字
  useEffect(() => {
    if (!mode) return
    let raf = 0
    let lastKey = ''
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const s = sched.current
      if (!s) return
      const hb = s.heardBeat()
      if (hb < 0) return
      const beat = Math.floor(hb) % BEATS_PER_BAR
      const bar = Math.floor(hb / BEATS_PER_BAR)
      let text = ''
      let me = false
      if (mode === 'echo') {
        if (bar < ECHO_PREP_BARS) text = '预备……'
        else if ((bar - ECHO_PREP_BARS) % 2 === 0) text = '果冻熊示范：鼓 叮 叮 叮'
        else {
          text = '换你了！'
          me = true
        }
      }
      const key = `${beat}|${text}`
      if (key !== lastKey) {
        lastKey = key
        setView({ beat, text, me })
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [mode])

  const changeBpm = (v: number) => {
    setBpm(v)
    bpmRef.current = v
    sched.current?.changeTempoAtNextBar(v) // 变速只在下一条小节线生效
  }

  return (
    <main className="dev">
      <h1>软糖回声乐园 · 试听</h1>
      <p className="lead">请开喇叭或戴耳机，iPhone 请关掉静音键。</p>

      <section>
        <h2>乐器</h2>
        <p className="note">点一下就响，可以连点，也可以多指一起按。键盘：← 或 F 是{t('inst.drum')}，→ 或 J 是{t('inst.tamb')}。</p>
        <div className="row pads">
          <PadButton pad="drum" label={t('inst.drum')} />
          <PadButton pad="tamb" label={t('inst.tamb')} />
        </div>
        <div className="row" style={{ marginTop: 'var(--space-3)' }}>
          <button type="button" className={`dev-btn${mode === 'metro' ? ' on' : ''}`} onClick={() => start('metro')}>
            {mode === 'metro' ? '停止节拍器' : '节拍器'}
          </button>
        </div>
      </section>

      <section>
        <h2>速度</h2>
        <p className="note">播放中也能换，会在下一小节开始变。</p>
        <div className="row">
          <div className="seg" role="group" aria-label="速度">
            {BPMS.map((b) => (
              <button key={b} type="button" className={b === bpm ? 'sel' : ''} onClick={() => changeBpm(b)}>
                {b}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h2>伴奏（共 6 种，一个世界一种）</h2>
        <p className="note">每种都是 8 小节循环：A 段 4 小节＋B 段 4 小节。① ② 是老师听过通过的，③–⑥ 是新增的，有空再听。</p>
        {BACKING_INFO.map((b) => {
          const m = `b${b.style}` as Mode
          return (
            <div className="row" key={b.style} style={{ marginBottom: 'var(--space-3)' }}>
              <button type="button" className={`dev-btn${mode === m ? ' on' : ''}`} onClick={() => start(m as Exclude<Mode, null>)}>
                {mode === m ? `停止 ${b.style}` : `播放 ${b.style}`}
              </button>
              <span className="note" style={{ margin: 0 }}>
                <strong>{b.name}</strong>　{b.desc}
              </span>
            </div>
          )
        })}
      </section>

      <section>
        <h2>回声示范</h2>
        <p className="note">
          先 2 小节节拍器预备，果冻熊示范一小节，再换你一小节（只剩节拍器，伴奏不停），共两回合。
        </p>
        <div className="row">
          <button type="button" className={`dev-btn${mode === 'echo' ? ' on' : ''}`} onClick={() => start('echo')}>
            {mode === 'echo' ? '停止' : '开始回声示范'}
          </button>
        </div>
        <div className="dots" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <i key={i} className={`${view.beat === i ? 'on' : ''}${i === 0 ? ' first' : ''}`} />
          ))}
        </div>
        <div className={`stage-text${view.me ? ' me' : ''}`} aria-live="polite">
          {view.text}
        </div>
      </section>
      <p className="hint">试听页仅供老师检查声音，不是游戏画面。</p>
    </main>
  )
}
