// 星星（0~3）。每颗有 --i（序号）；.on＝已得到。
// drop＝结算掉落：一颗一颗掉下来（时间常数在这里，Result 的音效用同一组数字对拍）。
export const DROP_START_MS = 350
export const DROP_GAP_MS = 420
/** 掉落动画开始后，这么久星星「落地」（音效在这一刻响） */
export const DROP_LAND_MS = 300

export default function Stars({ value, size = 56, drop = false }: { value: number; size?: number; drop?: boolean }) {
  return (
    <div
      className={`stars${drop ? ' drop' : ''}`}
      role="img"
      aria-label={`${value} / 3`}
      style={{ ['--star-size' as string]: `${size}px` }}
    >
      {[0, 1, 2].map((i) => (
        <svg
          key={i}
          className={`star${i < value ? ' on' : ''}`}
          style={{ ['--i' as string]: i, ['--d' as string]: `${DROP_START_MS + i * DROP_GAP_MS}ms` }}
          viewBox="0 0 48 48"
        >
          <path
            className="star-shape"
            d="M24 4.5l5.6 11.9 13 1.7-9.5 9 2.4 12.9L24 33.7 12.5 40l2.4-12.9-9.5-9 13-1.7z"
            strokeLinejoin="round"
          />
          <ellipse className="star-shine" cx="19" cy="15" rx="4.5" ry="2.6" transform="rotate(-30 19 15)" />
        </svg>
      ))}
    </div>
  )
}
