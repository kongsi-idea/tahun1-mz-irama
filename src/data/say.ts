// 所有给学生看／听的句子集中在这里（key → 中文）。画面只引用 key，不写死中文。
// 10-11 老师定：kerincing＝三角铁（内部 id 仍叫 tamb）；节奏念法 ta／ti-ti。改这里即可，不用动组件。
// 参数用 {n} 之类的占位，t('key', { n: 3 }) 代入。
// 句子里可以写 {drum}、{tamb}、{ta}、{titi}：会代入上面的 inst.*、term.*（所以乐器名、念法只在这个档案出现一次）。
// 语音：speak(key) 播 public/audio/<FNV(声音|句子)>.mp3（档名由句子内容算出，句子一改，旧录音就自动作废）。
// 要录音的 key 列在 VOICE_KEYS；跑 `python3 scripts/gen-voice.py` 生成 mp3 与 src/data/voice-manifest.ts。
// 只有 manifest 里有的档才会去载（没录音时静默，不会一直 404）。
import { VOICE_FILES } from './voice-manifest.ts'

export const SAY = {
  // 通用
  'app.title': '软糖回声乐园',
  'app.tagline': '跟着果冻熊，打出好听的回声',
  'app.credit': '黄慧欣老师',
  'common.back': '返回',
  'inst.drum': '鼓',
  'inst.tamb': '三角铁',
  'term.ta': 'ta',
  'term.titi': 'ti-ti',

  // 首页
  'home.start': '开始玩',
  'home.continue': '继续玩',
  'home.settings': '设定',

  // 声音检查＋校准
  'sc.title': '先来检查声音',
  'sc.tip': '请打开声音，关掉静音键',
  'sc.test': '点一点下面的垫子，听得到声音吗？',
  'sc.heard': '听到了！',
  'sc.cal.title': '跟着拍子点一点',
  'sc.cal.intro': '听到“嗒、嗒”，就跟着点垫子，一共点 12 下',
  'sc.cal.go': '开始',
  'sc.cal.running': '跟着拍子点！',
  'sc.cal.ok': '好棒，准备好了！',
  'sc.cal.retry': '好像没听清，再试一次吧',
  'sc.cal.shaky': '拍子有点不稳，再点一次会更准',
  'sc.cal.again': '再试一次',
  'sc.next': '下一步',
  'sc.skip': '先跳过',

  // 学一学
  'learn.title': '学一学',
  'learn.progress': '第 {n} 步，共 6 步',
  'learn.pass': '过关啦！',
  'learn.next': '下一步',
  'learn.go': '开始',
  'learn.all': '全部学会啦！去玩吧！',
  'learn.toMap': '去地图',
  'learn.retry': '没关系，再来一次！',
  'learn.1.title': '听一听',
  'learn.1.say': '这是{drum}，咚！这是{tamb}，叮！',
  'learn.1.hint': '点点看，两个垫子都试一试',
  'learn.1.hearDrum': '听我敲{drum}',
  'learn.1.hearTamb': '听我敲{tamb}',
  'learn.2.title': '分一分',
  'learn.2.say': '听！这是{drum}，还是{tamb}？',
  'learn.2.replay': '再听一次',
  'learn.2.right': '答对了！',
  'learn.2.wrong': '再听听看',
  'learn.join.title': '听四下，再开始',
  'learn.join.say': '先听“嗒、嗒、嗒、嗒”四下，看到 3、2、1，下一下就拍{drum}！还没准备好？没关系，它会一直转，等你。',
  'learn.3.title': '一颗草莓拍一下',
  'learn.3.say': '草莓一颗一颗亮起来，亮一颗，就拍一下{drum}！',
  'learn.4.title': '第一拍最重',
  'learn.4.say': '大草莓是{drum}，小柠檬是{tamb}，跟着拍子打！',
  'learn.5.title': '小测验',
  'learn.5.say': '我先打，再换你打一样的！',
  'learn.5.back': '再回去练一练「一颗草莓拍一下」吧',

  // 玩
  'play.ready': '预备……',
  'play.listen': '听我打',
  'play.look': '看着谱',
  'play.yourTurn': '换你了！',
  'play.countReady': '预备',
  'play.round': '第 {n} 轮',
  'play.combo': '连击 {n}',
  'play.start': '点一下开始',
  'play.pause': '声音睡着了，点一下叫醒它',
  'judge.perfect': '完美',
  'judge.good': '很好',
  'judge.early': '早了一点',
  'judge.late': '晚了一点',
  'judge.miss': '漏掉',
  'judge.wrong': '换一个',

  // 结算
  'result.title.3': '太棒了！',
  'result.title.2': '做得好！',
  'result.title.1': '过关啦！',
  'result.title.0': '再试一次，你可以的！',
  'result.accuracy': '准确度',
  'result.best': '我的最好成绩',
  'result.newBest': '新纪录！',
  'result.again': '再来一次',
  'result.next': '下一关',
  'result.map': '回地图',
  'result.soon': '更多关卡，敬请期待',

  // 地图
  'map.title': '关卡地图',
  'map.level': '第 {n} 关',
  'map.boss': '大考验',
  'map.locked': '先过上一关',
  'map.soon': '敬请期待',
  'map.world.1.name': '稳稳的拍子',
  'map.world.2.name': '两种声音',
  'map.world.3.name': '第一拍最重',
  'map.world.4.name': '快快慢慢',
  'map.world.5.name': '看谱打',
  'map.world.6.name': '长长的回声',

  // 设定
  'set.title': '设定',
  'set.cal': '重做声音校准',
  'set.cal.desc': '声音慢半拍时，重新跟着拍子点一次',
  'set.powersave': '省电模式',
  'set.powersave.desc': '关掉闪亮的小动画，旧手机会更顺',
  'set.volume': '音量',
  'set.on': '开',
  'set.off': '关',
  // C5：解锁乐手、换主角
  'result.newFriend': '新朋友来了！',
  'result.friendHint': '回首页，请它当主角吧',
  'result.allFriends': '全部朋友都来啦！',
  'friend.1.name': '小兔',
  'friend.2.name': '小猫',
  'friend.3.name': '小狗',
  'friend.4.name': '小鸭',
  'friend.5.name': '小象',
  'hero.bear': '果冻熊',
  'home.hero': '选一个主角',
  'map.friendLocked': '拿满三颗星，解锁新朋友',
} as const

export type SayKey = keyof typeof SAY

const NAMES: Record<string, 'inst.drum' | 'inst.tamb' | 'term.ta' | 'term.titi'> = {
  drum: 'inst.drum',
  tamb: 'inst.tamb',
  ta: 'term.ta',
  titi: 'term.titi',
}

function fill(text: string, params?: Record<string, string | number>): string {
  let s = text
  if (params) for (const k of Object.keys(params)) s = s.replaceAll(`{${k}}`, String(params[k]))
  for (const k of Object.keys(NAMES)) s = s.replaceAll(`{${k}}`, SAY[NAMES[k]])
  return s
}

/** 取文字。params 里的 {n} 之类会被代入；{drum}、{tamb}、{ta}、{titi} 自动换成当前的名称。 */
export function t(key: SayKey, params?: Record<string, string | number>): string {
  return fill(SAY[key], params)
}

// ---------- 语音 ----------
export const VOICE_ID = 'zh-CN-XiaoxiaoNeural'

/** 要预录语音的句子（按钮文字、数字、判定字这类纯标签不录）。 */
export const VOICE_KEYS: readonly SayKey[] = [
  'sc.tip',
  'sc.cal.intro',
  'sc.cal.ok',
  'sc.cal.retry',
  'sc.cal.shaky',
  'learn.pass',
  'learn.all',
  'learn.retry',
  'learn.1.say',
  'learn.2.say',
  'learn.2.right',
  'learn.2.wrong',
  'learn.join.say',
  'learn.3.say',
  'learn.4.say',
  'learn.5.say',
  'learn.5.back',
  'play.ready',
  'play.listen',
  'play.look',
  'play.yourTurn',
  'play.pause',
  'result.title.3',
  'result.title.2',
  'result.title.1',
  'result.title.0',
]

/** 念出来的字和画面上的字不同的少数 key（一次念完两句，因为新的语音会打断旧的）。 */
const VOICE_TEXT: Partial<Record<SayKey, string>> = {
  'sc.tip': '请打开声音，关掉静音键。点一点下面的垫子，听得到声音吗？',
  'learn.1.say': '这是{drum}，咚！这是{tamb}，叮！点点看，两个垫子都试一试。',
  'play.ready': '预备！',
}

export function voiceText(key: SayKey): string {
  return fill(VOICE_TEXT[key] ?? SAY[key])
}

/** FNV-1a：和 scripts/gen-voice.py 的档名算法一致。 */
export function fnv(str: string): string {
  let h = 0x811c9dc5
  for (const b of new TextEncoder().encode(str)) {
    h ^= b
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

export function voiceFile(key: SayKey): string {
  return fnv(`${VOICE_ID}|${voiceText(key)}`)
}

/** gen-voice.py 读这个：全部要录的句子。 */
export function voiceLines(): { key: SayKey; text: string; file: string }[] {
  return VOICE_KEYS.map((key) => ({ key, text: voiceText(key), file: voiceFile(key) }))
}

const VOICED: ReadonlySet<string> = new Set(VOICE_FILES)

let voice: HTMLAudioElement | null = null

/** 播语音。没有对应档案就静默（不用 speechSynthesis）。新的会打断旧的。 */
export function speak(key: SayKey): void {
  const file = voiceFile(key)
  if (!VOICED.has(file)) return
  try {
    voice?.pause()
    voice = new Audio(`/audio/${file}.mp3`)
    void voice.play().catch(() => {})
  } catch {
    // 不能播就算了
  }
}

export function stopSpeaking(): void {
  try {
    voice?.pause()
  } catch {
    // ignore
  }
  voice = null
}
