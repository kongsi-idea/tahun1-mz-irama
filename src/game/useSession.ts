import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { Session } from './session.ts'
import type { SessionOptions, SessionView } from './session.ts'
import { emitHit } from './fx.ts'
import { startBot } from './auto.ts'

const PULSE_LEN = 0.3 // 一拍里脉动占 0.3 拍（规格 §5.4）

/** 每拍脉动值 0~1（0.3 拍内走一个半正弦）。画面所有跟拍动效都读 --pulse。 */
export function pulseOf(beat: number): number {
  if (beat < 0) return 0
  const f = beat - Math.floor(beat)
  return f < PULSE_LEN ? Math.sin((Math.PI * f) / PULSE_LEN) : 0
}

function keyOf(v: SessionView): string {
  return `${v.phase}|${v.round}|${v.cursor}|${v.cueing ? 1 : 0}|${v.verdicts.join(',')}|${v.combo}|${v.count}`
}

/**
 * 跑一场 Session。rAF 里读 scheduler.heardBeat()：
 * - 每帧把脉动写进 rootRef 的 CSS 变数 --pulse、「离学生第一拍还差几拍」写进 --pbeat（缩小的预告圈用，不触发 React 重绘）；
 * - 只有「状态真的变了」（阶段、图标位置、判定、连击）才 setView。
 */
export function useSession(rootRef: RefObject<HTMLElement | null>) {
  const [view, setView] = useState<SessionView | null>(null)
  const sess = useRef<Session | null>(null)
  const raf = useRef(0)
  const stopBot = useRef<(() => void) | null>(null)

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current)
    raf.current = 0
    stopBot.current?.()
    stopBot.current = null
    sess.current?.stop()
    sess.current = null
    rootRef.current?.style.setProperty('--pulse', '0')
    rootRef.current?.style.setProperty('--pbeat', '-99')
  }, [rootRef])

  const start = useCallback(
    (opts: SessionOptions, bot: { ignoreMiss?: boolean } = {}) => {
      stop()
      const onHit = opts.onHit
      const s = new Session({
        ...opts,
        onHit: (e) => {
          emitHit(e)
          onHit?.(e)
        },
      })
      sess.current = s
      s.start()
      stopBot.current = startBot(s, bot) // 只有网址带 ?auto= 才会真的排程
      let lastKey = ''
      const loop = () => {
        const v = s.frame()
        rootRef.current?.style.setProperty('--pulse', pulseOf(v.beat).toFixed(3))
        rootRef.current?.style.setProperty('--pbeat', v.pbeat.toFixed(3))
        const k = keyOf(v)
        if (k !== lastKey) {
          lastKey = k
          setView(v)
        }
        if (v.phase === 'done') {
          raf.current = 0
          rootRef.current?.style.setProperty('--pulse', '0')
          rootRef.current?.style.setProperty('--pbeat', '-99')
          return
        }
        raf.current = requestAnimationFrame(loop)
      }
      raf.current = requestAnimationFrame(loop)
    },
    [stop, rootRef],
  )

  useEffect(() => stop, [stop])

  return { view, start, stop, session: sess }
}
