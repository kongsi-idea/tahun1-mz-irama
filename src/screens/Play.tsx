import { useEffect, useRef, useState } from 'react'
import { getContext, unlock } from '../engine/clock.ts'
import { loadCountVoice } from '../engine/countVoice.ts'
import { getLevel, accentMask, roundAccent, roundBpm } from '../data/levels.ts'
import { clearedWorlds, saveBest } from '../data/progress.ts'
import { speak, t } from '../data/say.ts'
import { useSession } from '../game/useSession.ts'
import { useCheer } from '../game/useCheer.ts'
import { isAuto } from '../game/auto.ts'
import { comboTier, phaseLabel, poseFor } from '../game/labels.ts'
import { summarize } from '../game/score.ts'
import type { RoundOutcome } from '../game/session.ts'
import type { RoundSpec } from '../game/timeline.ts'
import Stage from '../ui/Stage.tsx'
import Character from '../ui/Character.tsx'
import IconTrack from '../ui/IconTrack.tsx'
import TopBar from '../ui/TopBar.tsx'
import type { Go } from './nav.ts'

// 核心玩法：回声（规格 §3.3）。示范（草莓一直显示）→ 「换你了！」一整小节预备（大字＋人声「预备、3、2、1」）→ 学生打（每拍亮圈＋预告圈）→ 每个图标当场显示判定。一关 4 轮。
export default function Play({ levelId, go }: { levelId: string; go: Go }) {
  const level = getLevel(levelId)
  const rootRef = useRef<HTMLDivElement>(null)
  const { view, start, stop } = useSession(rootRef)
  const { cheer, onHit } = useCheer()
  const [needTap, setNeedTap] = useState(false)
  const started = useRef(false)

  const begin = () => {
    if (!level || started.current) return
    started.current = true
    void loadCountVoice() // 开场有 4 拍，够载完
    setNeedTap(false)
    const mode = level.demo ? 'echo' : 'look'
    const specs: RoundSpec[] = level.rounds.map((r, i) => ({
      pattern: r.pattern,
      bpm: roundBpm(level, i),
      mode,
      accent: accentMask(r.pattern, roundAccent(level, i)),
    }))
    start({
      rounds: specs,
      backing: level.backing,
      backingBoss: level.boss,
      onHit,
      onDone: (all: RoundOutcome[]) => {
        const score = summarize(all.map((o) => o.judged))
        const before = clearedWorlds()
        const saved = saveBest(level.id, score.stars, score.accuracy)
        const newly = clearedWorlds().filter((w) => !before.includes(w))
        go({
          name: 'result',
          result: {
            levelId: level.id,
            stars: score.stars,
            accuracy: score.accuracy,
            perfect: score.perfect,
            good: score.good,
            miss: score.miss,
            wrong: score.wrong,
            extra: score.extra,
            bestCombo: Math.max(0, ...all.map((o) => o.bestCombo)),
            prev: saved.prev,
            best: saved.best,
            newRecord: saved.newRecord,
            unlocked: newly.filter((w) => w <= 5),
            unlockedAll: newly.includes(6),
          },
        })
      },
    })
  }

  useEffect(() => {
    if (!level) {
      go({ name: 'map' })
      return
    }
    // 画面从地图点进来，声音已解锁；万一被系统挂起，让学生点一下再开始
    if (getContext().state === 'running') begin()
    else if (isAuto()) void unlock().then(begin) // 机器人没有手势，直接叫醒声音
    else setNeedTap(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const label = view ? phaseLabel(view, level?.demo === false ? 'look' : 'echo') : null
  useEffect(() => {
    // 「换你了」不念：预备那一小节由 countVoice 在拍点上念「预备、三、二、一」，两个声音会叠在一起
    if (label && label !== 'play.yourTurn') speak(label)
  }, [label])

  if (!level) return null
  const first = level.rounds[0].pattern
  const cells = view?.cells ?? first
  const accent = view?.accent ?? accentMask(first, roundAccent(level, 0))
  const round = view?.round ?? 0
  const combo = view?.combo ?? 0
  const count = view?.count ?? -1

  const leave = () => {
    stop()
    go({ name: 'map' })
  }

  const top = (
    <>
      <TopBar
        onBack={leave}
        right={
          <div className="round-dots" aria-label={t('play.round', { n: round + 1 })}>
            {level.rounds.map((_, i) => (
              <i key={i} className={i === round ? 'on' : i < round ? 'past' : ''} />
            ))}
          </div>
        }
      />
      <div className="top-msg">
        <Character pose={cheer ? 'cheer' : poseFor(view)} tier={comboTier(combo)} />
        <div className={`bubble bubble-play${!label && combo < 2 && count < 0 ? ' is-empty' : ''}`}>
          {label && (
            <strong key={label} className="phase-pop">
              {t(label)}
            </strong>
          )}
          {count >= 0 && (
            <b key={`c${round}-${count}`} className={`count-num${count === 0 ? ' is-ready' : ''}`}>
              {count === 0 ? t('play.countReady') : 4 - count}
            </b>
          )}
          {combo >= 2 && <span className="combo">{t('play.combo', { n: combo })}</span>}
        </div>
      </div>
    </>
  )

  return (
    <main className="screen screen-stage">
      <Stage
        ref={rootRef}
        combo={combo}
        top={top}
        track={
          <div className="track-panel">
            <IconTrack
              cells={cells}
              accent={accent}
              verdicts={view?.verdicts}
              timing={view?.timing}
              cursor={view?.cursor}
              cueing={view?.cueing}
              hideAll={!view}
            />
          </div>
        }
      />
      {needTap && (
        <div className="overlay">
          <button
            type="button"
            className="btn btn-coral btn-lg"
            onClick={() => {
              void unlock().then(() => {
                speak('play.ready')
                begin()
              })
            }}
          >
            {t('play.start')}
          </button>
        </div>
      )}
    </main>
  )
}
