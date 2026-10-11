import Art from './Art.tsx'
import { t } from '../data/say.ts'
import type { Cell } from '../data/levels.ts'
import type { LiveVerdict } from '../game/session.ts'

interface Props {
  cells: Cell[]
  /** 强拍遮罩（草莓画大一号） */
  accent?: boolean[]
  verdicts?: LiveVerdict[]
  /** 「很好」时早（-1）还是晚（1），在判定字下面小字提示 */
  timing?: number[]
  /** 目前拍到第几个；-1＝无 */
  cursor?: number
  /** true＝cursor 那个图标「被点亮」（示范／看谱／跟拍）；false＝只是轻轻的标记 */
  cueing?: boolean
  /** true＝cursor 之后的图标还没揭晓（回声示范时随声音逐个出现） */
  hideAhead?: boolean
  /** 全部揭晓前先隐藏（开场预备） */
  hideAll?: boolean
}

function Fruit({ cell }: { cell: Cell }) {
  return cell === 'drum' ? (
    <Art
      k="icon.strawberry"
      className="fruit-art"
      fallback={
        <span className="fruit fruit-strawberry">
          <i className="leaf" />
        </span>
      }
    />
  ) : (
    <Art k="icon.lemon" className="fruit-art" fallback={<span className="fruit fruit-lemon" />} />
  )
}

// 图标轨道：4 或 8 个图标；直立手机上 5 个以上折成两行（CSS 控制）。每个图标当场显示判定。
// 每个图标带一个 .approach「预告圈」：舞台根元素每帧写 --pbeat（离学生第一拍还差几拍），CSS 用 --i 算出这一格
// 还有几拍（--d）：从前 1 拍起由 1.8 倍缩到 1 倍，正好在拍点贴合亮圈（只用 transform／opacity）。
export default function IconTrack({
  cells,
  accent = [],
  verdicts = [],
  timing = [],
  cursor = -1,
  cueing = false,
  hideAhead = false,
  hideAll = false,
}: Props) {
  return (
    <div className="track" data-n={cells.length}>
      {cells.map((cell, i) => {
        const v = verdicts[i]
        const resolved = v !== undefined && v !== 'pending'
        const hidden = hideAll || (hideAhead && i > cursor)
        const cls = [
          'slot',
          `slot-${cell}`,
          accent[i] ? 'is-accent' : '',
          hidden ? 'is-hidden' : '',
          cueing && i === cursor ? 'is-lit' : '',
          !cueing && i === cursor ? 'is-cursor' : '',
          resolved ? `v-${v}` : '',
        ]
          .filter(Boolean)
          .join(' ')
        return (
          <div key={i} className={cls} style={{ ['--i' as string]: i }}>
            <div className="slot-icon">
              <Fruit cell={cell} />
              <i className="approach" />
              {(v === 'perfect' || v === 'good') && <i key={v} className="icon-flash" />}
            </div>
            {resolved && (
              <span key={v} className={`judge-tag jd-${v}`}>
                {t(`judge.${v}` as 'judge.perfect')}
                {v === 'good' && timing[i] ? (
                  <small className="judge-when">{t(timing[i] < 0 ? 'judge.early' : 'judge.late')}</small>
                ) : null}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
