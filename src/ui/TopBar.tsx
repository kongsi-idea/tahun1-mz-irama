import type { ReactNode } from 'react'
import { t } from '../data/say.ts'

// 左上「返回」＋可选的右侧内容。按钮至少 44×44。
export default function TopBar({ onBack, right }: { onBack?: () => void; right?: ReactNode }) {
  return (
    <div className="topbar">
      {onBack ? (
        <button type="button" className="btn btn-soft btn-sm" onClick={onBack}>
          <span aria-hidden="true">‹</span> {t('common.back')}
        </button>
      ) : (
        <span />
      )}
      {right ?? <span />}
    </div>
  )
}
