# 软糖回声乐园（tahun1-mz-irama）

一年级音乐节奏游戏（DSKP Muzik）。署名：黄慧欣老师。学生各自用设备玩。

- **唯一规格**：`../_planning/mz-irama.md`（分块见 §9）。与老师新指示冲突以老师为准，并回去改规格。
- **技术栈**：Vite + React 19，源码 `.ts/.tsx`（只用可擦除 TS 语法：无 enum、namespace、参数属性；没有 tsc），样式为一般 CSS + `src/styles/tokens.css` 变数。
- **依赖规则**：只能是 `../tahun1-bc-juxing` 的子集（已拿掉 mediapipe、tailwind）。**不准新增任何套件**（含 typescript、测试框架）。
- **测试**：`npm test` ＝ Node 内建 `node --test "tests/*.test.ts"`（type stripping）。engine 内部 import 必须写 `.ts` 副档名。
- **lint**：`npm run lint`（oxlint）。因为上层 `teaching-tools/.gitignore` 的 `/*/` 会让 oxlint 误判「无档案」，脚本用 `find` 列档并加 `--no-ignore`；本仓库 `git init` 后可改回单纯 `oxlint`。
- **字体**：标题 ZCOOL KuaiLe（粉圆缺大量简体字，见 `assets-src/fonts/huninn-coverage.md`）、内文 Noto Sans SC、数字 Fredoka。加介面字 → 编辑 `scripts/ui-chars.txt` → `python3 scripts/subset-fonts.py`。
- 素材原图放 `assets-src/`（不进 build）；`index.html` 已带 track-use 一行。
