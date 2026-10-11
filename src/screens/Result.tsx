import { useEffect } from 'react'
import { getLevel, nextLevelId } from '../data/levels.ts'
import { isUnlocked } from '../data/progress.ts'
import { speak, t } from '../data/say.ts'
import type { SayKey } from '../data/say.ts'
import Stars, { DROP_GAP_MS, DROP_LAND_MS, DROP_START_MS } from '../ui/Stars.tsx'
import Art from '../ui/Art.tsx'
import type { AssetKey } from '../data/assets.ts'
import { playSparkle, playStarDing, playUnlock } from '../engine/sfx.ts'
import Character from '../ui/Character.tsx'
import type { Go, PlayResult } from './nav.ts'

const pct = (x: number) => `${Math.round(x * 100)}%`

export default function Result({ result, go }: { result: PlayResult; go: Go }) {
  const nextId = nextLevelId(result.levelId)
  const hasNext = nextId !== null && getLevel(nextId) !== undefined
  const canNext = hasNext && isUnlocked(nextId)
  const titleKey = `result.title.${result.stars}` as 'result.title.0'
  useEffect(() => {
    speak(titleKey)
  }, [titleKey])
  // 仪式时间轴：星星一颗一颗掉（每颗落地「叮」）→ 新纪录贴纸（亮音）→ 新朋友卡片（小号角）。CSS 用同一组数字（animation-delay）。
  const starsEnd = DROP_START_MS + result.stars * DROP_GAP_MS
  const stickerAt = starsEnd + 150
  const friendAt = stickerAt + (result.newRecord ? 500 : 0)
  const hasFriend = result.unlocked.length > 0 || result.unlockedAll
  useEffect(() => {
    const ids: number[] = []
    for (let i = 0; i < result.stars; i++) {
      ids.push(window.setTimeout(() => playStarDing(i), DROP_START_MS + i * DROP_GAP_MS + DROP_LAND_MS))
    }
    if (result.newRecord) ids.push(window.setTimeout(() => playSparkle(), stickerAt + 120))
    if (hasFriend) ids.push(window.setTimeout(() => playUnlock(), friendAt + 150))
    return () => ids.forEach((id) => clearTimeout(id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <main className="screen result">
      <div className="result-card">
        <Character pose={result.stars >= 2 ? 'happy' : result.stars === 1 ? 'idle' : 'cheer'} />
        <h2>{t(titleKey)}</h2>
        <Stars value={result.stars} size={64} drop />
        <dl className="result-nums">
          <div>
            <dt>{t('result.accuracy')}</dt>
            <dd className="num">{pct(result.accuracy)}</dd>
          </div>
          <div>
            <dt>{t('result.best')}</dt>
            <dd className="num">{pct(result.best.acc)}</dd>
          </div>
        </dl>
        {result.newRecord && (
          <div className="sticker" style={{ animationDelay: `${stickerAt}ms` }}>
            {t('result.newBest')}
          </div>
        )}
        {hasFriend && (
          <div className="friend-card" style={{ animationDelay: `${friendAt}ms` }}>
            <div className="friend-pics">
              {result.unlocked.map((n) => (
                <Art key={n} k={`friend.${n}` as AssetKey} className="friend-pic" />
              ))}
            </div>
            <div className="friend-text">
              <strong>{t('result.newFriend')}</strong>
              <span>
                {result.unlocked.length > 0
                  ? `${result.unlocked.map((n) => t(`friend.${n}.name` as SayKey)).join('、')}　${t('result.friendHint')}`
                  : t('result.allFriends')}
              </span>
              {result.unlocked.length > 0 && result.unlockedAll && <span>{t('result.allFriends')}</span>}
            </div>
          </div>
        )}
        <div className="result-actions">
          <button
            type="button"
            className="btn btn-coral btn-lg"
            onClick={() => go({ name: 'play', levelId: result.levelId, nonce: Date.now() })}
          >
            {t('result.again')}
          </button>
          <div className="btn-row">
            {canNext && (
              <button
                type="button"
                className="btn btn-butter"
                onClick={() => go({ name: 'play', levelId: nextId, nonce: Date.now() })}
              >
                {t('result.next')}
              </button>
            )}
            <button type="button" className="btn btn-soft" onClick={() => go({ name: 'map' })}>
              {t('result.map')}
            </button>
          </div>
          {!hasNext && nextId !== null && <p className="soon">{t('result.soon')}</p>}
        </div>
        <p className="credit">{t('app.credit')}</p>
      </div>
    </main>
  )
}
