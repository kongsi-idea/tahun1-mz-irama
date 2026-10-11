import { unlock } from '../engine/clock.ts'
import { initSynth } from '../engine/synth.ts'
import { LEVELS_PER_WORLD, WORLD_COUNT, getLevel } from '../data/levels.ts'
import { FRIEND_COUNT, isFriendUnlocked, isUnlocked, starsOf, worldCleared, worldStars } from '../data/progress.ts'
import { t } from '../data/say.ts'
import type { SayKey } from '../data/say.ts'
import type { AssetKey } from '../data/assets.ts'
import Art from '../ui/Art.tsx'
import Stars from '../ui/Stars.tsx'
import TopBar from '../ui/TopBar.tsx'
import type { Go } from './nav.ts'

// 关卡地图：6 世界 × 3 关。★ 就解锁下一关；第 3 关是大考验。还没有资料的关显示「敬请期待」。
export default function MapScreen({ go }: { go: Go }) {
  const open = (id: string) => {
    void unlock()
    initSynth()
    go({ name: 'play', levelId: id, nonce: Date.now() })
  }
  return (
    <main className="screen map">
      <TopBar
        onBack={() => go({ name: 'home' })}
        right={
          <button type="button" className="btn btn-soft btn-sm" onClick={() => go({ name: 'settings' })}>
            {t('home.settings')}
          </button>
        }
      />
      <h2 className="screen-title">{t('map.title')}</h2>
      <div className="worlds">
        {Array.from({ length: WORLD_COUNT }, (_, w) => w + 1).map((w) => (
          <section key={w} className="world" data-world={w}>
            <header>
              <div className="world-thumb">
                <Art k={`world.${w}` as AssetKey} className="world-art" fallback={<span className="num">{w}</span>} />
              </div>
              <h3>{t(`map.world.${w}.name` as SayKey)}</h3>
              {w <= FRIEND_COUNT ? (
                <span
                  className={`friend-chip${isFriendUnlocked(w) ? ' on' : ''}`}
                  title={isFriendUnlocked(w) ? t(`friend.${w}.name` as SayKey) : t('map.friendLocked')}
                >
                  <Art k={`friend.${w}` as AssetKey} className="friend-chip-art" />
                </span>
              ) : (
                <span className={`friend-chip all${worldCleared(w) ? ' on' : ''}`} title={t('map.friendLocked')}>
                  <span className="friend-chip-star">★</span>
                </span>
              )}
              <span className="world-stars num">{worldStars(w)}/{LEVELS_PER_WORLD * 3}</span>
            </header>
            <div className="nodes">
              {Array.from({ length: LEVELS_PER_WORLD }, (_, i) => i + 1).map((i) => {
                const id = `${w}-${i}`
                const exists = getLevel(id) !== undefined
                const unlocked = exists && isUnlocked(id)
                const boss = i === LEVELS_PER_WORLD
                const stars = starsOf(id)
                const state = !exists ? 'soon' : unlocked ? 'open' : 'locked'
                return (
                  <button
                    key={id}
                    type="button"
                    className={`node node-${state}${boss ? ' is-boss' : ''}${stars > 0 ? ' has-stars' : ''}`}
                    disabled={state !== 'open'}
                    onClick={() => open(id)}
                    aria-label={state === 'open' ? `${t('map.level', { n: i })}` : t(state === 'soon' ? 'map.soon' : 'map.locked')}
                  >
                    <span className="node-num num">{boss ? '★' : i}</span>
                    {state === 'open' ? (
                      <Stars value={stars} size={18} />
                    ) : state === 'soon' ? (
                      <span className="node-dots" aria-hidden="true">
                        …
                      </span>
                    ) : (
                      <span className="node-lock" aria-hidden="true" />
                    )}
                    {boss && <span className="node-tag">{t('map.boss')}</span>}
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
