# 软糖回声乐园（tahun1-mz-irama）

一年级音乐节奏游戏（DSKP Muzik）。署名只在 Hub（`creator`＝黄慧欣老师／黄），**工具页里不放她的名字**（老师 10-11）。学生各自用设备玩。线上 https://tahun1-mz-irama.vercel.app（push main 自动部署）。

- **唯一规格**：`../_planning/mz-irama.md`（分块见 §9）。与老师新指示冲突以老师为准，并回去改规格。
- **技术栈**：Vite + React 19，源码 `.ts/.tsx`（只用可擦除 TS 语法：无 enum、namespace、参数属性；没有 tsc），样式为一般 CSS + `src/styles/tokens.css` 变数。
- **依赖规则**：只能是 `../tahun1-bc-juxing` 的子集（已拿掉 mediapipe、tailwind）。**不准新增任何套件**（含 typescript、测试框架）。
- **测试**：`npm test` ＝ Node 内建 `node --test "tests/*.test.ts"`（type stripping）。engine 内部 import 必须写 `.ts` 副档名。
- **lint**：`npm run lint`（oxlint）。因为上层 `teaching-tools/.gitignore` 的 `/*/` 会让 oxlint 误判「无档案」，脚本用 `find` 列档并加 `--no-ignore`；（仓库已 git init，仍沿用此写法）。
- **字体**：标题 ZCOOL KuaiLe（粉圆缺大量简体字，见 `assets-src/fonts/huninn-coverage.md`）、内文 Noto Sans SC、数字 Fredoka。加介面字 → 编辑 `scripts/ui-chars.txt` → `python3 scripts/subset-fonts.py`。
- 素材原图放 `assets-src/`（不进 build）；`index.html` 已带 track-use 一行。

## 关键决定（代码看不出来的）
- **玩的时候一句话都不念**（10-11 试用老师：人声和节奏混在一起会乱，熊的倒数节奏和 tok tok 不一样）。关卡与学一学跟拍中不 `speak()`；只在开始前说明、结算、过关时念。别再加回「预备三二一」人声或 phase 提示语音。
- **扶梯式预备**（同上回馈：「像超市手扶梯一直转，准备好了自己踏上去」）：学生回合前的预备小节一直重复，学生在某小节第 1 拍按下（任何垫子）才开始；最多多转 3 小节就照常开始（不卡死）。预备与学生回合节拍器同音量，所以判定可晚于排程。只能在小节线踏入，不做「任意拍踏入」（会破坏第一拍最重）。
- **画面时钟跟校准偏移走**（`calibrate.visualTime`）：老师反映「我按的和系统判的不一样」，原因推断是浏览器回报的喇叭延迟不准；圈亮＝系统等你按的时刻。
- **kerincing＝三角铁**（老师 10-11 在二年级对话选「名称、图、声音一起改」）；内部 id 仍叫 `tamb`，不要为改名去动 id。
- **示范提示用「我」不用「熊」**（「听我打」「我先打…」）：学生可以换小动物当主角。首页标语的「果冻熊」保留。
- 熊示范时草莓整排一直显示（不逐个揭晓）：老师说草莓「不见了、突然出来」会接不上。
- 测试开关：`?auto=1`、`&late=180`、`?auto=miss`、`&wait=N`（扶梯空转 N 小节）、`?skip=1`、`?debug=1`、`?listen=1`。机器人校准要扣喇叭延迟（`autoTap(pad, true)`），否则关卡里被判「早了」。
