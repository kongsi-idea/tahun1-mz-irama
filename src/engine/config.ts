// 引擎常数（规格 §2）。所有可调数字集中在这里。时间单位已写在名字里：_MS＝毫秒，_S＝秒。

export type Pad = 'drum' | 'tamb'

// ---- 拍子 ----
export const BEATS_PER_BAR = 4
/** 排程的最小单位＝八分音符（伴奏用）；一拍有 2 个 tick。 */
export const TICKS_PER_BEAT = 2

// ---- 判定（一年级，§2.4） ----
export const PERFECT_WINDOW_MS = 130
export const GOOD_WINDOW_MS = 230
/** 准确度＝（完美×1＋很好×0.6）÷音符数 */
export const PERFECT_WEIGHT = 1
export const GOOD_WEIGHT = 0.6
/** 每多按一下，准确度扣这么多（0~1 的比例，不影响该音符本身的判定）。 */
export const EXTRA_PRESS_PENALTY = 0.02
/** 星星门槛：≥60% ★、≥80% ★★、≥93% ★★★ */
export const STAR_THRESHOLDS: readonly number[] = [0.6, 0.8, 0.93]

// ---- 排程（§2.1） ----
export const LOOKAHEAD_INTERVAL_MS = 25
export const SCHEDULE_AHEAD_S = 0.1
/** 开始播放时，第一拍离「现在」多远（秒），留给浏览器喘口气。 */
export const START_LEAD_S = 0.12

// ---- 时钟（§2.2） ----
/** perf↔audio 对照的取样间隔（clock.ts 取最近 2 秒内的最大差值）。 */
export const CLOCK_RESYNC_MS = 200

// ---- 校准与自适应（§2.3） ----
export const CAL_BEATS = 12
export const CAL_USE_LAST = 8
export const CAL_BPM = 80
/** 后 8 下里至少要有这么多下被配到拍点，校准才算有效。 */
export const CAL_MIN_HITS = 6
/** 校准误差的离散度（中位数绝对离差，毫秒）超过这个，就提示「再点一次会更准」。 */
export const CAL_SHAKY_MS = 45
export const ADAPT_STEP_MAX_MS = 30
export const ADAPT_TOTAL_MAX_MS = 150
/** 一轮里至少要有这么多个有效误差，才做自适应。 */
export const ADAPT_MIN_SAMPLES = 3

// ---- 效能（§2.6） ----
export const PERF_WINDOW_MS = 2000
export const PERF_SLOW_FRAME_MS = 20
/** 超过这个间隔的帧视为切分页/卡住，不计入平均。 */
export const PERF_IGNORE_FRAME_MS = 250

// ---- 声音 ----
export const MASTER_VOLUME = 0.8
/** 伴奏比打击声低一截。 */
export const BACKING_VOLUME = 0.7

// ---- 储存 ----
export const STORAGE_PREFIX = 'mz-irama-t1:'
