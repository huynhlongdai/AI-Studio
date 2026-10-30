import { useState } from 'react'
import { findService } from '../../lib/catalog'
import { navigate } from '../../router'
import { useStore, useMine, type QuoteStatus } from '../../store'
import { Btn, Empty, Page, PageHead, StatusDot, Tabs, day, left, vnd } from '../../ui'

const TABS: { id: 'open' | 'accepted' | 'closed'; label: string; match: QuoteStatus[] }[] = [
  { id: 'open', label: 'Đang chờ', match: ['sent'] },
  { id: 'accepted', label: 'Đã chấp nhận', match: ['accepted'] },
  { id: 'closed', label: 'Hết hạn / từ chối', match: ['expired', 'rejected'] },
]

export default function Quotes() {
  const db = useMine()
  const { requote } = useStore()
  const [tab, setTab] = useState<'open' | 'accepted' | 'closed'>('open')
  const list = db.quotes.filter((q) => TABS.find((t) => t.id === tab)!.match.includes(q.status))
  return (
    <Page max={880}>
      <PageHead title="Báo giá" sub="Mọi báo giá lấy từ bảng giá của studio — trợ lý AI không tự đặt giá." end={<Btn kind="primary" onClick={() => navigate('/app/chat')}>Yêu cầu báo giá</Btn>} />
      <div className="grid gap-0">
        <Tabs value={tab} onChange={setTab} items={TABS.map((t) => ({ id: t.id, label: <>{t.label} <span className="text-ink-3 font-normal">{db.quotes.filter((q) => t.match.includes(q.status)).length}</span></> }))} />
        {list.length === 0 ? <Empty text={tab === 'open' ? 'Không có báo giá nào đang chờ. Chat với trợ lý để nhận báo giá mới.' : 'Chưa có báo giá nào ở mục này.'} /> : (
          <ul>
            {list.map((q) => {
              const svc = findService(q.service)!
              return (
                <li key={q.code} className="flex items-center gap-4 py-3.5 border-b border-line max-sm:flex-wrap">
                  <a href={`#/app/bao-gia/${q.code}`} className="flex-1 min-w-0 group">
                    <p className="text-sm font-medium group-hover:underline underline-offset-4">{svc.name} · {q.brand}</p>
                    <p className="text-xs text-ink-3"><span className="font-mono">{q.code}</span> · tạo {day(q.createdAt)}{q.status === 'sent' && <> · <span className="text-warn">{left(q.expiresAt - Date.now())}</span></>}</p>
                  </a>
                  <span className="font-mono text-[13px] tabular-nums">{vnd(q.price.total)}</span>
                  {q.status === 'sent' && <Btn size="s" kind="primary" onClick={() => navigate(`/app/bao-gia/${q.code}`)}>Xem & chấp nhận</Btn>}
                  {q.status === 'accepted' && <StatusDot status="done">Đơn {q.orderCode}</StatusDot>}
                  {q.status === 'expired' && <Btn size="s" onClick={() => navigate(`/app/bao-gia/${requote(q.code)}`)}>Yêu cầu báo giá lại</Btn>}
                  {q.status === 'rejected' && <StatusDot status="stop">Đã từ chối</StatusDot>}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Page>
  )
}
