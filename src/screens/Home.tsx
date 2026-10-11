import { unlock } from '../engine/clock.ts'
import { hasCalibration } from '../engine/calibrate.ts'
import { initSynth } from '../engine/synth.ts'
import { useState } from 'react'
import { FRIEND_COUNT, getHero, isFriendUnlocked, isLearnDone, setHero, unlockedFriends } from '../data/progress.ts'
import type { AssetKey } from '../data/assets.ts'
import Art from '../ui/Art.tsx'
import { t } from '../data/say.ts'
import type { SayKey } from '../data/say.ts'
import Character from '../ui/Character.tsx'
import type { Go } from './nav.ts'

export default function Home({ go }: { go: Go }) {
  const [hero, setHeroState] = useState(getHero())
  const pick = (n: number) => {
    setHero(n)
    setHeroState(n)
  }
  const returning = hasCalibration() && isLearnDone()
  const start = () => {
    // 第一次点击：解锁声音（iOS／Safari 一定要在手势里）
    void unlock()
    initSynth()
    if (!hasCalibration()) go({ name: 'soundcheck', next: isLearnDone() ? { name: 'map' } : { name: 'learn' } })
    else if (!isLearnDone()) go({ name: 'learn' })
    else go({ name: 'map' })
  }
  return (
    <main className="screen home">
      <div className="home-hills" aria-hidden="true" />
      <div className="home-card">
        <div className="home-bear">
          <Character pose="idle" />
        </div>
        {unlockedFriends().length > 0 && (
          <div className="hero-pick" role="radiogroup" aria-label={t('home.hero')}>
            {Array.from({ length: FRIEND_COUNT + 1 }, (_, n) => n).map((n) => {
              const ok = n === 0 || isFriendUnlocked(n)
              const name = n === 0 ? t('hero.bear') : t(`friend.${n}.name` as SayKey)
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={hero === n}
                  aria-label={name}
                  disabled={!ok}
                  className={`hero-btn${hero === n ? ' on' : ''}${ok ? '' : ' locked'}`}
                  onClick={() => pick(n)}
                >
                  <Art k={(n === 0 ? 'bear.idle' : `friend.${n}`) as AssetKey} className="hero-art" />
                </button>
              )
            })}
          </div>
        )}
        <h1>{t('app.title')}</h1>
        <p className="tagline">{t('app.tagline')}</p>
        <button type="button" className="btn btn-coral btn-lg" onClick={start}>
          {returning ? t('home.continue') : t('home.start')}
        </button>
        <button
          type="button"
          className="btn btn-soft"
          onClick={() => {
            void unlock()
            go({ name: 'settings' })
          }}
        >
          {t('home.settings')}
        </button>
      </div>
    </main>
  )
}
