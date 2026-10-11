import { useEffect, useState } from 'react'
import { isPowerSave, onPowerSaveChange, setPowerSave } from '../engine/perf.ts'
import { setMasterVolume } from '../engine/synth.ts'
import { loadSettings, saveSettings } from '../data/progress.ts'
import { t } from '../data/say.ts'
import TopBar from '../ui/TopBar.tsx'
import type { Go } from './nav.ts'

export default function Settings({ go }: { go: Go }) {
  const [volume, setVolume] = useState(() => loadSettings().volume)
  const [save, setSave] = useState(isPowerSave())
  useEffect(() => onPowerSaveChange((on) => setSave(on)), [])

  const changeVolume = (v: number) => {
    setVolume(v)
    setMasterVolume(v)
    saveSettings({ volume: v })
  }
  return (
    <main className="screen settings">
      <TopBar onBack={() => go({ name: 'home' })} />
      <div className="settings-card">
        <h2>{t('set.title')}</h2>

        <div className="set-row">
          <div>
            <strong>{t('set.cal')}</strong>
            <p>{t('set.cal.desc')}</p>
          </div>
          <button
            type="button"
            className="btn btn-butter"
            onClick={() => go({ name: 'soundcheck', next: { name: 'settings' } })}
          >
            {t('set.cal')}
          </button>
        </div>

        <div className="set-row">
          <div>
            <strong>{t('set.powersave')}</strong>
            <p>{t('set.powersave.desc')}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={save}
            className={`switch${save ? ' on' : ''}`}
            onClick={() => setPowerSave(!save)}
          >
            <i />
            <span>{save ? t('set.on') : t('set.off')}</span>
          </button>
        </div>

        <div className="set-row">
          <div>
            <strong>{t('set.volume')}</strong>
          </div>
          <input
            className="slider"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            aria-label={t('set.volume')}
            onChange={(e) => changeVolume(Number(e.target.value))}
          />
        </div>
      </div>
    </main>
  )
}
