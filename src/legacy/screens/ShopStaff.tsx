import { useState } from 'react'
import { CHANNELS, type Lead } from '../lib/agents'
import { navigate } from '../router'
import { customerName, useStore } from '../store'
import { Btn, Icon, when } from '../ui'

const HEAT = { hot: ['Nóng', 'bg-red-500'], warm: ['Ấm', 'bg-warn'], cold: ['Nguội', 'bg-idle'] } as const

/** Cổng nhân viên của shop: nhận lead do agent chuyển, gọi lại người mua, cập nhật kết quả. Mobile-first. */
export default function ShopStaff() {
  const { db, shopLogin, shopLogout, shopUpdateLead } = useStore()
  const [open, setOpen] = useState<string | null>(null)
  const [f, setF] = useState<'mine' | 'all'>('mine')
  const s = db.session.shop
  const a = s && db.sales.find((x) => x.customer === s.customer)
  const me = a?.team?.find((m) => m.id === s?.id)
  if (!a || !me) return (
    <div className="min-h-dvh grid place-items-center p-6">
      <div className="w-full max-w-sm grid gap-3">
        <h1 className="text-xl">Cổng nhân viên shop</h1>
        <p className="text-[13px] text-ink-3">Nhận lead từ trợ lý bán hàng và gọi lại người mua. Bản thử nghiệm: chọn tài khoản. Bản thật đăng nhập bằng SĐT + mã OTP.</p>
        {db.sales.flatMap((x) => (x.team ?? []).filter((m) => m.active).map((m) => (
          <button key={x.customer + m.id} type="button" onClick={() => shopLogin(x.customer, m.id)} className="text-left border border-line rounded-r2 p-3 hover:border-accent"><b className="text-[13px]">{m.name}</b><span className="block text-xs text-ink-3">{customerName(db, x.customer)} · {x.leads.filter((l) => l.assignee === m.id && l.status === 'new').length} lead mới</span></button>
        )))}
        <a href="#/" className="text-[13px] text-ink-3">Về trang chủ</a>
      </div>
    </div>
  )
  const list = a.leads.filter((l) => f === 'all' || l.assignee === me.id).sort((x, y) => (x.status === 'new' ? 0 : 1) - (y.status === 'new' ? 0 : 1) || y.t - x.t)
  const l = a.leads.find((x) => x.id === open)
  return (
    <div className="min-h-dvh max-w-[560px] mx-auto">
      <header className="h-14 px-4 border-b border-line flex items-center gap-2 sticky top-0 bg-white z-10">
        {l ? <button type="button" onClick={() => setOpen(null)} aria-label="Quay lại" className="size-10 -ml-2 grid place-items-center"><Icon name="arrow" className="rotate-180" /></button> : <span className="size-7 rounded-r bg-ink text-white grid place-items-center"><Icon name="user" size={14} /></span>}
        <div className="min-w-0"><p className="text-sm font-medium leading-tight truncate">{l ? l.name : me.name}</p><p className="text-xs text-ink-3">{customerName(db, a.customer)}</p></div>
        {!l && <button type="button" onClick={() => { shopLogout(); navigate('/nv') }} className="ml-auto text-[13px] text-ink-3 min-h-10">Đăng xuất</button>}
      </header>
      {l ? <LeadView l={l} onUpdate={(p) => shopUpdateLead(l.id, p)} /> : (
        <main className="p-4 grid gap-3">
          <div className="grid grid-cols-3 border border-line rounded-r2 divide-x divide-line text-center [&>div]:p-3">
            <div><p className="text-xl font-mono">{a.leads.filter((x) => x.assignee === me.id && x.status === 'new').length}</p><p className="text-xs text-ink-3">Cần gọi</p></div>
            <div><p className="text-xl font-mono">{a.leads.filter((x) => x.assignee === me.id && x.status === 'sent').length}</p><p className="text-xs text-ink-3">Đã liên hệ</p></div>
            <div><p className="text-xl font-mono">{a.leads.filter((x) => x.assignee === me.id && x.status === 'won').length}</p><p className="text-xs text-ink-3">Chốt được</p></div>
          </div>
          <div className="flex gap-1">{([['mine', 'Của tôi'], ['all', 'Cả shop']] as const).map(([k, t]) => <button key={k} type="button" onClick={() => setF(k)} className={`min-h-9 px-3 rounded-r text-[13px] ${f === k ? 'bg-ink text-white' : 'border border-line'}`}>{t}</button>)}</div>
          <ul className="grid gap-2">
            {list.map((x) => (
              <li key={x.id}><button type="button" onClick={() => setOpen(x.id)} className={`w-full text-left border rounded-r2 p-3.5 grid gap-1 ${x.status === 'new' ? 'border-accent/40' : 'border-line'}`}>
                <span className="flex items-center gap-2"><span className={`size-2 rounded-full ${HEAT[x.heat][1]}`} /><b className="text-sm">{x.name}</b><span className="ml-auto text-xs text-ink-3">{when(x.t)}</span></span>
                <span className="text-[13px] text-ink-2">{x.need}</span>
                <span className="text-xs text-ink-3">{CHANNELS[x.channel].name} · {x.status === 'new' ? 'Chưa gọi' : x.status === 'sent' ? 'Đã liên hệ' : x.status === 'won' ? 'Chốt được' : 'Không thành'}{f === 'all' && ` · ${a.team?.find((m) => m.id === x.assignee)?.name ?? 'chưa giao'}`}</span>
              </button></li>
            ))}
            {list.length === 0 && <li className="text-[13px] text-ink-3 p-4 text-center">Chưa có lead.</li>}
          </ul>
        </main>
      )}
    </div>
  )
}

function LeadView({ l, onUpdate }: { l: Lead; onUpdate: (p: Partial<Lead>) => void }) {
  const [note, setNote] = useState(l.note)
  return (
    <main className="p-4 grid gap-4 pb-28">
      <a href={`tel:${l.phone.replace(/\s/g, '')}`} onClick={() => l.status === 'new' && onUpdate({ status: 'sent' })} className="flex items-center justify-center gap-2 min-h-12 rounded-r2 bg-accent text-white text-sm font-medium"><Icon name="chat" size={16} /> Gọi {l.phone}</a>
      <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-2.5 text-[13px] [&>dt]:text-ink-3">
        <dt>Nhu cầu</dt><dd>{l.need}</dd><dt>Sản phẩm</dt><dd>{l.product}</dd><dt>Ngân sách</dt><dd>{l.budget}</dd>
        <dt>Mức độ</dt><dd>{HEAT[l.heat][0]}</dd><dt>Tóm tắt</dt><dd className="text-ink-2">{l.summary}</dd><dt>Gợi ý</dt><dd>{l.next}</dd>
        <dt>Đồng ý</dt><dd>{l.consentAt ? `Người mua đồng ý được gọi · ${when(l.consentAt)}` : 'Chưa ghi nhận — hỏi lại trước khi tư vấn'}</dd>
      </dl>
      <label className="grid gap-1.5 text-[13px]"><span className="text-ink-3">Ghi chú sau cuộc gọi</span><textarea value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => onUpdate({ note })} rows={3} className="border border-line rounded-r p-2.5 outline-none focus:border-accent" /></label>
      <div className="fixed inset-x-0 bottom-0 bg-white border-t border-line p-3 pb-[calc(12px+env(safe-area-inset-bottom))]"><div className="max-w-[560px] mx-auto grid grid-cols-3 gap-2">
        {([['sent', 'Đã liên hệ'], ['won', 'Chốt được'], ['lost', 'Không thành']] as const).map(([k, t]) => <Btn key={k} size="l" kind={l.status === k ? 'primary' : 'ghost'} onClick={() => onUpdate({ status: k, note })}>{t}</Btn>)}
      </div></div>
    </main>
  )
}
