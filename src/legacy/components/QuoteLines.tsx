import type { PriceResult } from '../lib/pricing'
import { vnd } from '../ui'

export function QuoteLines({ price, compact = false }: { price: PriceResult; compact?: boolean }) {
  return (
    <ul className={`grid gap-1.5 font-mono ${compact ? 'text-xs' : 'text-[13px]'} text-ink-2`}>
      {price.items.map((i) => (
        <li key={i.label} className="flex items-baseline gap-2"><span>{i.label}{i.quantity > 1 && ` ×${i.quantity}`}</span><span className="lead" /><b className="font-normal text-ink tabular-nums whitespace-nowrap">{vnd(i.amount)}</b></li>
      ))}
      {price.discount > 0 && <li className="flex items-baseline gap-2"><span>Giảm giá gói</span><span className="lead" /><b className="font-normal text-ok">−{vnd(price.discount)}</b></li>}
      <li className="flex items-baseline gap-2 border-t border-line pt-2 mt-1"><span>Tổng</span><span className="lead" /><b className="font-normal text-ink">{vnd(price.total)}</b></li>
      <li className="flex items-baseline gap-2 text-ink"><span>{price.depositPct === 100 ? 'Thanh toán trước 100%' : `Cọc ${price.depositPct}%`}</span><span className="lead" /><b className={`font-medium ${compact ? 'text-[13px]' : 'text-sm'}`}>{vnd(price.depositAmount)}</b></li>
    </ul>
  )
}
