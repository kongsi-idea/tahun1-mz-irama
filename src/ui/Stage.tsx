import { useEffect } from 'react'
import type { ReactNode, Ref } from 'react'
import Pad from './Pad.tsx'
import { bindKeyboard } from '../engine/input.ts'
import { startFrameMonitor, stopFrameMonitor } from '../engine/perf.ts'
import Particles from './Particles.tsx'
import Art from './Art.tsx'
import { comboTier } from '../game/labels.ts'

// 游戏版面（规格 §3.7）：横屏上 35／中 20／下 45；直立上 30／中 18／下 52（比例在 CSS）。
// ref 指向根元素：session 每帧把 --pulse 写在这里，里面所有跟拍动效都读它。
export default function Stage({
  top,
  track,
  ref,
  combo = 0,
}: {
  top: ReactNode
  track: ReactNode
  ref?: Ref<HTMLDivElement>
  combo?: number
}) {
  useEffect(() => {
    const unbind = bindKeyboard(window)
    startFrameMonitor()
    return () => {
      unbind()
      stopFrameMonitor()
    }
  }, [])
  const tier = comboTier(combo)
  return (
    <div className="stage" ref={ref} data-combo-tier={tier}>
      <div className="stage-bg" aria-hidden="true">
        <div className="bg-layer bg-far">
          <Art
            k="bg.main"
            className="bg-art"
            fallback={
              <>
                <i className="hill hill-far" />
                <i className="hill hill-near" />
              </>
            }
          />
        </div>
        <i className="glow" />
        <div className="bg-layer bg-near">
          <i className="puff puff-1" />
          <i className="puff puff-2" />
          <i className="puff puff-3" />
          <i className="puff puff-4" />
        </div>
        {tier >= 3 && (
          <div className="confetti">
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} style={{ ['--k' as string]: i }} />
            ))}
          </div>
        )}
      </div>
      <div className="stage-top">{top}</div>
      <div className="stage-track">{track}</div>
      <div className="stage-pads">
        <Pad pad="drum" />
        <Pad pad="tamb" />
      </div>
      <Particles />
    </div>
  )
}
