import { lazy, Suspense, useEffect, useState } from 'react'
import './styles/app.css'
import { isPowerSave, onPowerSaveChange } from './engine/perf.ts'
import { setMasterVolume } from './engine/synth.ts'
import { loadSettings } from './data/progress.ts'
import type { Route } from './screens/nav.ts'
import Home from './screens/Home.tsx'
import SoundCheck from './screens/SoundCheck.tsx'
import Learn from './screens/Learn.tsx'
import MapScreen from './screens/Map.tsx'
import Play from './screens/Play.tsx'
import Result from './screens/Result.tsx'
import Settings from './screens/Settings.tsx'

// 开发用页面按需载入，不进正式画面的主包。
const Debug = lazy(() => import('./dev/Debug.tsx'))
const Listen = lazy(() => import('./dev/Listen.tsx'))

// 画面流程（规格 §3.1）：
//   首页 →（首次）声音检查＋校准 → 学一学（首次必做）→ 关卡地图 → 关卡 → 结算 →（再来一次／下一关／回地图）
// ?skip=1 跳过学一学并解锁全部关卡；?debug=1、?listen=1 是开发页。
function Game() {
  const [route, setRoute] = useState<Route>({ name: 'home' })

  useEffect(() => {
    setMasterVolume(loadSettings().volume)
    const apply = (on: boolean) => {
      document.documentElement.dataset.powersave = on ? 'on' : 'off'
    }
    apply(isPowerSave())
    return onPowerSaveChange(apply)
  }, [])

  const go = setRoute
  switch (route.name) {
    case 'home':
      return <Home go={go} />
    case 'soundcheck':
      return <SoundCheck go={go} next={route.next} />
    case 'learn':
      return <Learn go={go} />
    case 'map':
      return <MapScreen go={go} />
    case 'play':
      return <Play key={route.nonce} levelId={route.levelId} go={go} />
    case 'result':
      return <Result result={route.result} go={go} />
    case 'settings':
      return <Settings go={go} />
  }
}

export default function App() {
  const q = new URLSearchParams(window.location.search)
  const page = q.get('debug') === '1' ? <Debug /> : q.get('listen') === '1' ? <Listen /> : <Game />
  return <Suspense fallback={null}>{page}</Suspense>
}
