// 一场游戏（学一学的跟拍／测验、正式关卡共用）：负责排程声音、收输入、当场判定、每轮结算。
// 画面从 frame() 取状态；所有跟拍视觉都从 scheduler.heardBeat() 算，不另开计时器。
import { GOOD_WINDOW_MS } from '../engine/config.ts'
import { getContext } from '../engine/clock.ts'
import { Scheduler, beatToSeconds } from '../engine/scheduler.ts'
import { attachBacking, levelBackingOptions } from '../engine/backing.ts'
import type { BackingHandle, BackingStyle } from '../engine/backing.ts'
import { onInput } from '../engine/input.ts'
import { judge } from '../engine/judge.ts'
import type { JudgeResult, TimedPad, Verdict } from '../engine/judge.ts'
import type { Pad } from '../engine/config.ts'
import { adaptAfterRound, getOffsetMs, visualTime } from '../engine/calibrate.ts'
import { click, initSynth, playPad, setBackingLevel } from '../engine/synth.ts'
import { playCount } from '../engine/countVoice.ts'
import { buildTimeline, segmentAt } from './timeline.ts'
import type { PhaseName, RoundSpec, Timeline } from './timeline.ts'
import type { Cell } from '../data/levels.ts'

export type LiveVerdict = Verdict | 'pending'

export interface RoundOutcome {
  index: number
  judged: JudgeResult
  /** 本轮结束时的连击数 */
  endCombo: number
  /** 本轮中途出现过的最高连击 */
  bestCombo: number
}

/** 某个学生音符「当下」有了判定（每个音符只通知一次）。画面用它放粒子、判定字、熊的反应。 */
export interface HitEvent {
  round: number
  /** 第几个音符 */
  index: number
  verdict: Verdict
  /** perfect／good／miss＝应该打的乐器；wrong＝学生实际按的（另一个）乐器 */
  pad: Pad
}

export interface SessionView {
  phase: PhaseName | 'done'
  round: number
  rounds: number
  cells: Cell[]
  accent: boolean[]
  /** 目前的拍位置（图标序号）；开场预备与休息时为 -1 */
  cursor: number
  /** 只有 demo／look／follow-play 时，图标「被点亮」；echo 的 play 时 cursor 只是一个轻轻的标记 */
  cueing: boolean
  verdicts: LiveVerdict[]
  /** 「很好」的音符是早还是晚：-1＝早、1＝晚、0＝其他（完美／漏／错或还没判） */
  timing: number[]
  combo: number
  /** heardBeat（小数），画面算每拍脉动用 */
  beat: number
  /** 预备（prep）时第几拍（0~3，画面依序「预备、3、2、1」）；其他时候 -1 */
  count: number
  /** heardBeat 减去本轮「学生第一拍」（预备、学生回合、休息才有值；其他时候 -99）。画面算「缩小的预告圈」用 */
  pbeat: number
}

/** 学生回合的预备小节，节拍器比平常响（第 1 拍最重）。 */
const PREP_CLICK_BOOST = 1.6
/** 关卡里伴奏整体降到这个比例，让节拍器压过伴奏。 */
export const BACKING_LEVEL_IN_GAME = 0.6

export interface SessionOptions {
  rounds: RoundSpec[]
  backing?: BackingStyle | null
  /** 大考验：伴奏多加一层 */
  backingBoss?: boolean
  onHit?: (e: HitEvent) => void
  onRoundEnd?: (o: RoundOutcome) => void
  onDone?: (all: RoundOutcome[]) => void
}

const IN_MARGIN_S = 0.4
const NO_PBEAT = -99

export class Session {
  readonly tl: Timeline
  private sched: Scheduler
  private backing: BackingHandle | null = null
  private inputs: TimedPad[] = []
  private offInput: (() => void) | null = null
  private offTick: (() => void) | null = null
  private finalized = 0
  private carry = 0
  private carryIn: number[] = []
  private outcomes: RoundOutcome[] = []
  private done = false
  private announced = new Set<number>()
  private opts: SessionOptions

  constructor(opts: SessionOptions) {
    this.opts = opts
    this.tl = buildTimeline(opts.rounds)
    // 画面跟「系统等你按的时间」走（拍点＋校准偏移），看圈按和听声音按判定一样
    this.sched = new Scheduler({ tempoMap: this.tl.tempoMap, heard: visualTime })
  }

  get scheduler(): Scheduler {
    return this.sched
  }

  start(): void {
    initSynth()
    const { tl } = this
    if (this.opts.backing) {
      this.backing = attachBacking(this.sched, this.opts.backing, levelBackingOptions(this.opts.backingBoss))
      setBackingLevel(BACKING_LEVEL_IN_GAME)
    }
    this.offInput = onInput((e) => this.inputs.push({ time: e.audioTime, pad: e.pad }))
    this.offTick = this.sched.subscribe((t) => {
      if (!t.isBeat || t.beat >= tl.totalBeats) return
      const seg = segmentAt(tl, t.beat)
      click(t.time, t.beatInBar === 0, seg?.phase === 'prep' ? PREP_CLICK_BOOST : 1)
      if (seg && seg.phase === 'prep') {
        // 预备拍人声「预备、三、二、一」，排在拍点上（念长了就在下一拍前收掉）
        const len = beatToSeconds(t.beat + 1, tl.tempoMap) - beatToSeconds(t.beat, tl.tempoMap)
        playCount(t.beat - seg.start, t.time, len * 0.9)
      }
      if (seg && seg.phase === 'demo') {
        const spec = tl.rounds[seg.round].spec
        const cell = spec.pattern[t.beat - seg.start]
        if (cell) playPad(cell, t.time, spec.accent?.[t.beat - seg.start] ? 1 : 0.85)
      }
    })
    this.sched.start()
  }

  stop(): void {
    this.sched.stop()
    this.backing?.detach()
    this.backing = null
    this.offTick?.()
    this.offInput?.()
    this.offTick = null
    this.offInput = null
    setBackingLevel(1)
  }

  /** 第 round 轮、第 i 个音符的 audio 时间。 */
  noteTime(round: number, i: number): number {
    const lay = this.tl.rounds[round]
    return this.sched.origin + beatToSeconds(lay.playStart + i, this.tl.tempoMap)
  }

  private judgeRound(round: number): JudgeResult {
    const lay = this.tl.rounds[round]
    const n = lay.playBeats
    const off = getOffsetMs()
    const expected: TimedPad[] = lay.spec.pattern.map((pad, i) => ({ pad, time: this.noteTime(round, i) }))
    const lo = expected[0].time - IN_MARGIN_S + off / 1000
    const hi = expected[n - 1].time + IN_MARGIN_S + off / 1000
    const ins = this.inputs.filter((x) => x.time >= lo && x.time <= hi)
    return judge(expected, ins, off)
  }

  /** 把「刚有了判定」的音符通知 onHit（每个音符只一次）。 */
  private announce(round: number, verdicts: LiveVerdict[]): void {
    const cb = this.opts.onHit
    if (!cb) return
    const pattern = this.tl.rounds[round].spec.pattern
    verdicts.forEach((v, i) => {
      if (v === 'pending') return
      const key = round * 1000 + i
      if (this.announced.has(key)) return
      this.announced.add(key)
      const exp = pattern[i]
      cb({ round, index: i, verdict: v, pad: v === 'wrong' ? (exp === 'drum' ? 'tamb' : 'drum') : exp })
    })
  }

  /** 该轮最后一个音符的判定窗已过（audio 时间）。 */
  private roundWindowClosed(round: number, now: number): boolean {
    const lay = this.tl.rounds[round]
    return now > this.noteTime(round, lay.playBeats - 1) + (getOffsetMs() + GOOD_WINDOW_MS) / 1000 + 0.05
  }

  private liveVerdicts(round: number, now: number): LiveVerdict[] {
    const j = this.judgeRound(round)
    const off = getOffsetMs()
    return j.results.map((res, i) => {
      if (res.verdict !== 'miss') return res.verdict
      return now > this.noteTime(round, i) + (off + GOOD_WINDOW_MS) / 1000 + 0.02 ? 'miss' : 'pending'
    })
  }

  private runAfter(verdicts: LiveVerdict[], carry: number): { combo: number; best: number } {
    let run = carry
    let best = carry
    for (const v of verdicts) {
      if (v === 'pending') break
      if (v === 'perfect' || v === 'good') {
        run++
        if (run > best) best = run
      } else run = 0
    }
    return { combo: run, best }
  }

  /** 每个 rAF 呼叫一次：处理每轮结算，并回传画面状态。 */
  frame(): SessionView {
    const { tl } = this
    const now = getContext().currentTime
    // 先结算已经打完的轮
    while (this.finalized < tl.rounds.length && this.roundWindowClosed(this.finalized, now)) {
      const idx = this.finalized
      const judged = this.judgeRound(idx)
      const live = judged.results.map((r) => r.verdict as LiveVerdict)
      this.announce(idx, live)
      this.carryIn[idx] = this.carry
      const { combo, best } = this.runAfter(live, this.carry)
      adaptAfterRound(judged.errorsMs)
      const outcome: RoundOutcome = { index: idx, judged, endCombo: combo, bestCombo: best }
      this.carry = combo
      this.outcomes.push(outcome)
      this.finalized++
      this.opts.onRoundEnd?.(outcome)
    }
    const beat = this.sched.heardBeat()
    const seg = segmentAt(tl, beat)
    if (!seg) {
      if (!this.done && this.finalized >= tl.rounds.length) {
        this.done = true
        this.stop()
        this.opts.onDone?.(this.outcomes)
      }
      const last = tl.rounds[tl.rounds.length - 1]
      return {
        phase: 'done',
        round: last.index,
        rounds: tl.rounds.length,
        cells: last.spec.pattern,
        accent: last.spec.accent ?? [],
        cursor: -1,
        cueing: false,
        verdicts: this.outcomes[last.index]?.judged.results.map((r) => r.verdict) ?? [],
        timing: [],
        combo: this.carry,
        beat,
        count: -1,
        pbeat: NO_PBEAT,
      }
    }
    // lead 阶段显示第 0 轮的空格
    const ri = seg.round >= 0 ? seg.round : 0
    const lay = tl.rounds[ri]
    const inRound = seg.round >= 0
    let cursor = -1
    let cueing = false
    if (inRound && (seg.phase === 'demo' || seg.phase === 'look' || seg.phase === 'play')) {
      cursor = Math.min(seg.beats - 1, Math.floor(beat - seg.start))
      // 学生回合也亮：每一拍到了，该拍的图标亮圈（和学一学第 3 步一样）；下一拍的预告圈由 pbeat 在画面里算
      cueing = true
    }
    const count = inRound && seg.phase === 'prep' ? Math.min(seg.beats - 1, Math.floor(beat - seg.start)) : -1
    const pbeat =
      seg.phase === 'lead' || (inRound && (seg.phase === 'prep' || seg.phase === 'play' || seg.phase === 'rest'))
        ? beat - lay.playStart // 开场预备时算第 0 轮的（跟拍模式第一格的预告圈要从预备最后一拍开始缩）
        : NO_PBEAT
    let verdicts: LiveVerdict[] = []
    let timing: number[] = []
    let combo = this.carry
    if (inRound && (seg.phase === 'play' || seg.phase === 'rest')) {
      verdicts =
        ri < this.finalized
          ? this.outcomes[ri].judged.results.map((r) => r.verdict)
          : this.liveVerdicts(ri, now)
      if (ri >= this.finalized) this.announce(ri, verdicts)
      const res = ri < this.finalized ? this.outcomes[ri].judged.results : this.judgeRound(ri).results
      timing = res.map((r) => (r.verdict === 'good' && r.errorMs !== null ? (r.errorMs < 0 ? -1 : 1) : 0))
      combo = this.runAfter(verdicts, ri < this.finalized ? this.carryIn[ri] : this.carry).combo
    }
    return {
      phase: seg.phase,
      round: ri,
      rounds: tl.rounds.length,
      cells: lay.spec.pattern,
      accent: lay.spec.accent ?? [],
      cursor,
      cueing,
      verdicts,
      timing,
      combo,
      beat,
      count,
      pbeat,
    }
  }
}
