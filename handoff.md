# 软糖回声乐园 · 交接

## ✅ 2026-10-11 下午 v1.1 已上线（试用老师回馈）：verify 本机 3 轮通过、push 自动部署、Hub 1.1＋新封面／缩图、check 全过
- 回馈（含 3 段 WhatsApp 语音，mlx_whisper 转写）：指示人声和节奏混在一起会乱；熊的倒数节奏和 tok tok 节拍不一样；不用讲话，出 3 2 1 就好；加一个教学教他们听「tok tok tok tok」；像超市扶梯一直转，准备好了自己踏上去。
- 改法：① 关卡与学一学跟拍中**完全不念**（拿掉 countVoice／`play.ready`／phase label 语音；开始时 stopSpeaking）；② **扶梯**：`timeline.extendPrep`＋`Scheduler.shiftTempoFrom`，Session.checkStep 在学生第 1 拍判定窗关后看有没有按（任何垫子），没有就预备再转一小节，最多 `MAX_WAIT_BARS=3`；预备与学生回合节拍器同音量，晚决定听不出来；③ 学一学加第 3 步「听四下，再开始」（mode `join`：无开场、无示范），共 6 步，测验失败回第 4 步；④ 学一学示范也不再隐藏草莓。59 测试过。
- 旧档 countVoice.ts／gen-count.py／count-*.mp3 搬到 `~/Documents/待删除/mz-irama/countvoice/`。
- 同批：示范提示「听熊打」→「听我打」、学一学「听我敲…」「我先打…」（换小动物也通用）。
- 同批（my-agent-61 在二年级对话里问老师后代改，12:55，我收进来）：kerincing＝**三角铁**——名称、垫子图 `pad-tamb.webp`、熊图 `bear-tamb.webp`、合成声 `synth.tamb()`（不谐和泛音长余音）一起改，内部 id 仍是 `tamb`；规格 §10-2 已定案。Hub 封面重画（`assets-src/hub/cover-tri-*.png`）。
- 测试开关新增 `?auto=1&wait=N`（机器人每轮让扶梯空转 N 小节才踏入）；机器人校准改扣喇叭延迟（`autoTap(pad, true)`），不然关卡里会被判「早了」。

## ✅ 2026-10-11 已上线 v1.0
- 老师在关口②说「可以发布」。工具：https://tahun1-mz-irama.vercel.app（repo kongsi-idea/tahun1-mz-irama，push main 自动部署，Actions 首跑 success）。
- Hub：条目已加（署名黄慧欣老师／黄，title_bm「Taman Gema Irama」老师定），封面＋3 张正式网址截图；Hub 部署＋alias；`npm run check -- tahun1-mz-irama` 全部通过。
- 仍待：ta／ti-ti 念法与「铃鼓」名（黄老师）；世界 5 是否改名「看图打」；实机 5 分钟漂移；地图熊剪影盖住「大考验」；新版校准待课堂实测。

## 目前做到哪
**⏸ 关口②：等老师第二次试玩（2026-10-11 05:xx）**。老师 01:50 回馈 7 条已修（见下段）；C6 verify（18 关版）：学一学走得完且不能跳过、世界 1 三关 ★★★、late=180 校准后仍 ★★★（offset 180）、漏按结算温和、CPU 4× 平均帧 16.7ms、控制台 0 错误、无 404、track-use 在、首页载入 616KB、图片最大 41KB。之后主代理补修：预备大字 1–4 原本没渲染（Play.tsx 漏接 `count`）、空泡泡加 `is-empty`、直立 8 颗水果 54→66px、第 1 拍大字用 em 变太小。
- **10-11 老师：「我按的拍子和系统 detect 到的不一样」已改（待老师实测）**：① 画面时钟改成 `calibrate.visualTime()`＝currentTime − 校准偏移（0~350ms），圈亮／预告圈缩到底＝系统等你按的时刻，看圈按和听声音按判定一致（旧版画面用 outputLatency，浏览器报的延迟不准时，看圈按会整体偏）；② perf↔audio 对照改成每 200ms 取样、取 2 秒内最大差值（currentTime 是一块一块跳的，单次取样会落后几到二十毫秒）；③ 校准 8 拍→12 拍取后 8 下，算离散度，不稳就提示「再点一次会更准」，成功画面也能再试；④ 判「很好」时小字显示「早了一点／晚了一点」。57 测试过；未派 verify（Playwright MCP 连不上）。

- **10-11 第二次试玩回馈（预备难进）已改**：① 熊示范时草莓整排一直显示（拿掉 hideAhead／开场 hideAll），学生打的就是刚刚看到的那排；② 预备小节改成倒数：画面「预备、3、2、1」，人声由 `engine/countVoice.ts` 用 AudioContext 排在拍点上念（`scripts/gen-count.py` 生成 `count-0~3.mp3`，剪掉开头静音，念超过 0.9 拍就收）；「换你了」改成只显示不念（会和倒数叠音）。lint／56 测试／tsc／build 过；未派 verify 复验。
- 未过：§7-4 五分钟漂移 headless 量到 10–11ms（两次），量法含一帧取样误差、最近一拍迟到在 0–16ms 摆动无单调上升；要在实机（老师电脑 `?debug=1`）再量一次。
- 未验：iPhone 声音解锁与手感（关口②老师测）、世界 6 与各世界逐关、刚好 ★ 的解锁边界。

**C0–C5 完成，C6 验收中（2026-10-11）**。主代理已合并 C5 的句子进 `say.ts`（`say-c5.ts` 已搬到 `~/Documents/待删除/mz-irama/`）、补字体字，tsc（借 3g-assessment）0 错、lint 0、51 测试过、build 过；dist 1.8MB。正式预览 `npx vite preview --host --port 5181`。

**C2 素材完成（2026-10-11，Opus＋cx-draw）**：22 张 WebP 在 `public/img/`（熊 6 姿势含 `bear-tamb`、乐手 5、草莓／柠檬、鼓垫／铃鼓垫、背景、世界缩图 6），共 624KB；原图在 `assets-src/img/`，Hub 封面原图 `assets-src/hub/cover.png`（字已逐字核对）。去背用 `scripts/cutout.py`（只去与图边相连的近白区，`--sat` 可降饱和）。世界缩图降饱和 0.72–0.9。

**C4 内容完成（2026-10-11）**：30 关全部写完（`src/data/levels.ts`，`npm run dump:levels` 印出并存 `docs/levels-dump.txt`）；伴奏扩成 6 种（每种 A 段 4 小节＋B 段 4 小节＝8 小节循环，大考验关多一层闪亮音）；试听页 `?listen=1` 列出 6 种伴奏；语音 23 句已用 edge-tts 生成（`scripts/gen-voice.py`，档名由句子内容算出，写进 `src/data/voice-manifest.ts`）；`say.ts` 全面检查过（句子里用 `{drum}、{tamb}、{ta}、{titi}` 代入，乐器名／念法只在 say.ts 出现）。新增测试：关卡规则加强（`tests/levels.test.ts`）、伴奏用假 AudioContext 跑 6 风格×4 选项（`tests/backing.test.ts`）。
- 关卡偏离规格处：①世界 1 与世界 3 的节奏型本来就只有一种（全鼓／DTTT／DTDT），为了「同一关 4 轮不重复」改用「一轮比一轮快一点（bpm）＋4→8 拍」来区分；②`RoundDef` 新增可选 `accent`（轮上覆盖关卡的强拍规则），世界 3 大考验与世界 6 用它混用两种强拍；Play 用 `roundAccent(level, i)`。
- 语音改了 `say.ts`：`speak(key)` 现在按 `FNV(声音|句子)` 找档，只播 manifest 里有的；改任何一句要重跑 `python3 scripts/gen-voice.py`。`sc.tip`、`learn.1.say` 的语音念的是合并后的两句（见 `VOICE_TEXT`）。Learn／Result／SoundCheck 补了 speak（过关、答对／答错、重试、结算标题、校准提示）。
- 世界与伴奏一一对应：1 尤克里里小路、2 音乐盒晚安（老师听过通过，音色未动）；3 小钟滴答、4 口风琴小镇、5 海边沙锤、6 彩虹竖琴（新增，待老师有空听）。

**C3 画面完成（2026-10-11）**：Home、SoundCheck（声音检查＋8 拍校准）、Learn（5 步）、Map（6 世界×5 关）、Play（回声）、Result、Settings 全部实作，流程首页→声音检查→学一学→地图→关卡→结算可走通。lint 0、build 过、40 个测试过（新增 `tests/levels.test.ts`、`tests/game.test.ts`）。**尚未经浏览器实测**（C6 由 verify 做；本块只用 SSR 渲染各画面确认不抛错＋tsc 型别检查）。
C1 小关口（老师试听声音）已通过。素材由 C2 接入。

## 老师试玩回馈（2026-10-11 01:50）——7 条已全部修完（待 verify 浏览器实测）
1. ✅ 判定标签「完美／很好」的字顶部被切掉（标签高度或 overflow）。→ 根因是命中时放大的图标（transform 叠上来）盖住了没有 z-index 的标签上半；`.judge-tag` 改 `position:relative; z-index:3`＋flex 置中＋行高 1.35＋留 8px 间距，其他标题字小标签（fx-word、node-tag、combo、bubble strong 等）一并给足行高。
2. ✅ 每个世界只要 3 关：`levels.ts` 18 关（第 1 关＝原 1、第 2 关＝原 3／4 挑或合并、第 3 关＝原 5 大考验）；Map 每世界 3 格、`LEVELS_PER_WORLD=3`、解锁乐手＝该世界 3 关 ★★★、`progress.ts`／dump／tests 同改；旧存档 id（1-4、1-5）读不到关卡，直接忽略。
3. ✅ 关卡学生回合每拍亮圈（`SessionView.cueing` 学生回合也 true，世界 5 同）＋缩小预告圈：`IconTrack` 每格 `.approach`，`useSession` rAF 把 `--pbeat`（`SessionView.pbeat`＝heardBeat−学生第一拍）写在 `.stage`，CSS 用 `--i` 算 1.8→1 倍（只 transform／opacity）。
4. ✅ `PREP_BEATS=4`（休息同改 4 拍，轮长＝2n+8，仍在小节线）；预备时泡泡里大字 1、2、3、4（`SessionView.count`，Fredoka），节拍器 ×1.6、第 1 拍最重，「换你了！」语音沿用；伴奏 `clearBeat` 选项（只关卡用：反拍不发声、每拍低音轻拍 `thump`、不抖动、伴奏总线 ×0.6）；`tests/backing-phase.test.ts` 查同相——排程与拍点本来就同相，没有错位 bug，「对不上」来自切分音与弱拍太多。
5. ✅ 直立：`.stage` 网格改 `1fr auto auto`，轨道靠下贴着垫子、熊变大吃剩余空间；垫子宽 43vw（390 宽≈168px）；4 颗一行 slot≈78px、8 颗两行 slot≈66px。横屏仍 35/20/45，垫子宽改 min(30vw,40dvh)。
6. ✅ `Pad.tsx` 只剩图（`.pad-art`）＋下方文字；按下压扁作用在图上；图读不到才退回 `.pad-ph`。
7. ✅ 没字（也没连击）时 `.bubble.is-empty{visibility:hidden}`（占位但不显示，熊不会左右跳）。

## C3 画面流程
首页「开始玩」→ 没校准过 → SoundCheck（点垫子听声音→「听到了」→ 8 拍校准，失败 2 次或 `?skip=1` 才出现「先跳过」）→ 没学过 → Learn 1→5 → 地图 → 关卡（Play）→ Result →（再来一次＝同关重开／下一关／回地图）。已校准且学过：首页直接到地图。设定页「重做校准」走 SoundCheck 后回设定。`?skip=1`：学一学视为已完成、全部关卡解锁（只在记忆体，不写存档）。

## 给 C4（内容）的接口
- **关卡**：只改 `src/data/levels.ts` 的 `LEVELS` 阵列（型别说明在档头）。现为 18 关（6 世界×3 关）。`tests/levels.test.ts` 会检查：每关 4 轮、每轮 4 或 8 拍、BPM 60–120、第 3 关（大考验）每轮 8 拍、强拍规则（`accent`）位置是鼓其余是铃鼓。世界 4 变速＝每轮写 `bpm`（轮与轮之间变速，一定在小节线）；世界 5＝`demo: false`（无声看谱，图标随拍亮、不发声）。
- **语音**：句子全在 `src/data/say.ts` 的 `SAY`；要录音的 key 列在 `VOICE_KEYS`；`python3 scripts/gen-voice.py` 生成 mp3＋manifest（C4 已完成）。
- 改念法（ta／ti-ti）、乐器名（铃鼓）：只改 `SAY` 的 `inst.*`、`term.*`。

## C5 动效与回馈（2026-10-11 完成，未经浏览器实测）
- **跟拍呼吸**：`useSession` rAF 写 `--pulse`（`pulseOf`，0.3 拍半正弦）→ `.bear`／`.pad`／`.puff` 用 `scale(1+0.03*--pulse)`；`.stage[data-combo-tier]` 设 `--amp`（软糖丘弹得更高）与 `--glow-on`。
- **按下**：`ui/Pad.tsx` pointerdown 加 `.is-pressed` → `app.css` `.pad.is-pressed .pad-body`（60ms 压扁 scale(1.05,0.9)，180ms `--ease-spring` 过冲弹回）。机器人／键盘输入（`source !== 'pointer'`）也触发。
- **打中**：`Session.onHit(HitEvent)`（`game/session.ts` `announce()`，每个音符一次，perfect／good／miss／wrong）→ `useSession` 转 `game/fx.ts` → `ui/Particles.tsx`（判定字 `.fx-word`＋粒子 `.fx-dot`，perfect 14 颗、good 8 颗，省电／减少动态 0 颗）；图标闪光 `.icon-flash`（`IconTrack`）＋`icon-hit` 动画。
- **漏掉／按错**：`.slot.v-miss`（变灰、下沉 4px，360ms ease-out）；`.slot.v-wrong`（`wobble` 轻摇＋变淡）。无震动、无声。
- **角色**：`game/labels.ts poseFor`（示范跟声音：鼓→bear.drum、铃鼓→bear.tamb；连击 10→happy、20→spin）；5 连击＝`.bear[data-tier='1'][data-pose='idle']` 摆头；漏掉 `game/useCheer.ts`（0.9s 换 bear.cheer）。主角可换朋友（`Character` 读 `getHero()`），朋友只有一张图，`.bear[data-friend]` 用 CSS 做 bob／hop／rotateY 转／摇。
- **背景**：`Stage.tsx` 两层视差 `.bg-far`（bg.main，`drift-far` 26s）＋`.bg-near`（4 个 CSS 软糖丘 `.puff`，`drift-near` 18s）；tier≥2 `.glow`；tier 3 `.confetti` 彩带。省电／减少动态都关。
- **结算**：`Stars drop`（`star-drop`，常数 `DROP_*_MS` 在 `ui/Stars.tsx`）；每颗落地 `engine/sfx.ts playStarDing(i)`（C-E-G）；新纪录 `.sticker`（`sticker-in`＋`playSparkle`）；新朋友 `.friend-card`（`card-in`＋`playUnlock`）。
- **解锁**：`data/progress.ts`：`worldCleared／clearedWorlds／isFriendUnlocked／unlockedFriends／getHero／setHero`（状态由各关星数推算，不另存；只有「选的主角」存 localStorage `hero`）。`Play` 存档前后比较 `clearedWorlds()`，把 `unlocked`／`unlockedAll` 放进 `PlayResult`。首页 `.hero-pick` 选主角（≥1 位朋友解锁才显示，未解锁＝剪影）；地图每世界标题列 `.friend-chip`（世界 6＝★ 徽章）。
- **句子**：C5 新句放 `data/say-c5.ts` 的 `EXTRA`，用 `tx(key)`（先查 SAY，所以合并进 say.ts 后自动生效）。
- **自动玩机器人**（验收用，只有网址带 auto 才启用；`game/auto.ts`、`engine/input.ts injectInput`）：`?auto=1` 每个学生音符在拍点自动送正确输入；`?auto=1&late=180` 整体晚 180ms（绝对时间，校准与每轮自适应照常运作）；`?auto=miss` 关卡全不按。机器人也会走完声音检查（8 拍校准）、学一学 5 步（含自动答对、自动按「下一步」）与 Play 开场的「点一下开始」；学一学与声音检查在 `auto=miss` 下仍会通过（不然卡死）。验收用 `?friends=all` 可把 5 位朋友视为全部解锁（不写存档）。
- 效能：省电（`html[data-powersave=on]`）关粒子、视差、光晕、彩带、每拍呼吸；`prefers-reduced-motion` 去掉视差、彩带、角色摆动／跳／转、粒子，保留按下回馈与每拍呼吸。
- 待 C6 浏览器实测的点：软糖丘与 bg.main 叠起来的观感、友人图在 `--bear-size` 里的大小、直立手机上 `.fx-word` 位置。

## 给 C2（素材）接入
放档案到 `public/img/`，在 `src/data/assets.ts` 把对应 key 的 `null` 改成路径（如 `'/img/bear-idle.webp'`）。key：`bear.idle|drum|happy|spin|cheer`、`icon.strawberry|lemon`、`pad.drum|tamb`（垫子本身，没有外框；读不到才用 CSS 占位）、`bg.main`（填了会取代 CSS 山丘）、`world.1..6`、`friend.1..5`（C5 已用：首页选主角、地图头像、结算「新朋友」）。读不到档案会自动退回占位。

## 画面结构
`src/screens/*`（nav.ts 是 Route 型别）、`src/ui/*`（Stage 版面、Pad、IconTrack、Character、Stars、Art、TopBar、Particles 占位）、`src/game/*`（timeline 时间轴、session 排程＋当场判定＋每轮结算、useSession、score、labels）、`src/data/*`（levels、say、assets、progress）、`src/styles/app.css`。一轮＝示范 n 拍＋预备 4 拍＋学生 n 拍＋休息 4 拍；学一学第 3、4 步用 `follow` 模式（图标随拍亮、同时打）。

## 试听页用法（给老师听）
`npm run dev -- --host`，手机／电脑开 `http://<本机IP>:5180/?listen=1`。有鼓、铃鼓大垫（可连点多指，键盘 ←F／→J）、节拍器、伴奏 ①–⑥（BPM 70/85/100/110，播放中可换，下一小节生效）、回声示范（2 小节预备 → 熊示范 → 换你，共 2 回合）。iPhone 请关静音键。
`?debug=1`：偏移、上一轮误差、帧时间、省电状态、节拍漂移、outputLatency；按钮「开始／停止伴奏」「校准一次」。C6 用它量 §7 第 4 条（5 分钟 <10ms）。

## 引擎要点（C3/C4 接手必读）
- 所有时间：秒（audio 时钟）；误差与偏移：毫秒，正＝晚。常数全在 `config.ts`。
- 排程：`Scheduler`（tempo map，变速只在小节线，`changeTempoAtNextBar`），订阅 `Tick{time,beat,bar,beatInBar,isBeat,stepSec,bpm}`；画面用 `scheduler.heardBeat()`。
- 输入：`bindPad(el,pad)`／`bindKeyboard()`／`onInput(cb)`，回传 `{pad,audioTime,source}`，按下即发声。
- 判定：`judge(expected, inputs, offsetMs)`。配对：乐器对的先按误差最小贪心配（很好窗内），剩余音符再配乐器错的＝wrong，其余输入＝多按（每下扣 2% 准确度）。
- 校准：`runCalibration()` 存档；每轮后 `adaptAfterRound(result.errorsMs)`；`hasCalibration()` 为 false＝新玩家。
- 省电：`startFrameMonitor()`、`isPowerSave()`、`onPowerSaveChange()`、`setPowerSave()`。
- 引擎内 import 必须带 `.ts`，类型 import 用 `import type`。

## 待办
- 引擎小改动（C3）：`synth.ts` 新增 `setMasterVolume(v)`（设定页音量），其余引擎未动。
- 二年级复制 `src/engine/` 时：synth 换大鼓／钹／锣、judge 窗口改 100/190、config 改 STORAGE_PREFIX。

## 下一步
C2 素材（Opus）可与 C4 内容并行；C5 动效；C6 verify 浏览器验收（含 §7 第 1、6 条：学一学走完、1366×768 与 390×844 截图）。

最后更新：2026-10-11（C4）
