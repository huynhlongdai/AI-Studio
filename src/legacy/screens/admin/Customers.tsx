import { useState } from 'react'
import { findPlan, findService } from '../../lib/catalog'
import { navigate } from '../../router'
import { canStaff, creditOf, orderStatusAdmin, useStore } from '../../store'
import { Btn, Empty, Icon, Modal, Page, PageHead, day, vnd, when } from '../../ui'

export default function Customers({ selected }: { selected?: string }) {
  const { db } = useStore()
  const [q, setQ] = useState('')
  const rows = db.customers.map((c) => {
    const orders = db.orders.filter((o) => o.customer === c.id)
    const spend = db.payments.filter((p) => p.customer === c.id && p.status === 'paid' && p.method === 'qr').reduce((s, p) => s + p.amount, 0)
    const lastAt = Math.max(c.createdAt, ...orders.map((o) => o.createdAt))
    return { c, orders, spend, lastAt }
  }).filter((r) => !q || (r.c.name + r.c.contact + r.c.email).toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.spend - a.spend)
  const sel = db.customers.find((c) => c.id === selected)
  return (
    <Page max={1280}>
      <PageHead title="Khách hàng" sub={`${db.customers.length} khách · ${db.customers.filter((c) => c.plan).length} đang dùng gói tháng`} />
      <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Tìm tên, người liên hệ, email…" aria-label="Tìm khách hàng" className="h-8 max-md:h-11 px-2.5 border border-line rounded-r text-[13px] outline-none w-72 max-sm:w-full" />
      {rows.length === 0 ? <Empty text="Không tìm thấy khách hàng." /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] border-collapse min-w-[760px]">
            <thead><tr className="text-left text-xs text-ink-3 border-b border-line [&>th]:font-normal [&>th]:py-2 [&>th]:pr-3"><th>Khách hàng</th><th>Ngành</th><th>Gói</th><th className="text-right">Đơn</th><th className="text-right">Đã chi</th><th className="text-right">Credit</th><th className="text-right">Hoạt động gần nhất</th></tr></thead>
            <tbody>{rows.map(({ c, orders, spend, lastAt }) => (
              <tr key={c.id} onClick={() => navigate(`/admin/khach-hang/${c.id}`)} className="border-b border-line hover:bg-side cursor-pointer [&>td]:py-2.5 [&>td]:pr-3">
                <td><span className="block font-medium">{c.name || 'Khách mới'}</span><span className="block text-xs text-ink-3">{c.contact} · {c.email}</span></td>
                <td className="text-ink-2">{c.industry}</td>
                <td>{c.plan ? findPlan(c.plan.code)?.name : <span className="text-ink-3">—</span>}</td>
                <td className="text-right tabular-nums">{orders.length}</td>
                <td className="text-right tabular-nums">{vnd(spend)}</td>
                <td className="text-right tabular-nums">{vnd(Math.max(0, creditOf(db, c.id)))}</td>
                <td className="text-right font-mono text-xs text-ink-3">{day(lastAt)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {sel && <CustomerPanel id={sel.id} />}
    </Page>
  )
}

function CustomerPanel({ id }: { id: string }) {
  const { db, updateCustomer, adjustCredit } = useStore()
  const c = db.customers.find((x) => x.id === id)!
  const orders = db.orders.filter((o) => o.customer === id)
  const ledger = db.ledger.filter((l) => l.customer === id)
  const [credit, setCredit] = useState(false)
  const [amt, setAmt] = useState('100000')
  const [why, setWhy] = useState('Tặng khách quen')
  const [tag, setTag] = useState('')
  const close = () => navigate('/admin/khach-hang')
  return (
    <div className="fixed inset-0 z-[80] bg-ink/30" onClick={close}>
      <aside onClick={(e) => e.stopPropagation()} className="enter absolute right-0 top-0 h-full w-[480px] max-w-full bg-white border-l border-line overflow-auto p-5 grid gap-5 content-start" aria-label={c.name}>
        <div className="flex items-start gap-2">
          <div><h2 className="text-base">{c.name || 'Khách mới'}</h2><p className="text-[13px] text-ink-3">{c.contact} · khách từ {day(c.createdAt)}</p></div>
          <button type="button" onClick={close} aria-label="Đóng" className="ml-auto size-10 grid place-items-center rounded-r hover:bg-soft text-ink-3"><Icon name="x" /></button>
        </div>
        <div className="flex gap-2 flex-wrap"><Btn kind="primary" onClick={() => navigate(`/admin/hop-thu/${c.id}`)}><Icon name="chat" size={14} /> Mở hội thoại</Btn>{canStaff(db, 'customers.credit') && <Btn onClick={() => setCredit(true)}>Điều chỉnh credit</Btn>}</div>
        <dl className="grid grid-cols-2 gap-px bg-line border border-line rounded-r2 overflow-hidden text-[13px]">
          {[['Email', c.email || '—'], ['Điện thoại', c.phone || '—'], ['Kênh ưa thích', { zalo: 'Zalo', phone: 'Điện thoại', email: 'Email' }[c.channel]], ['MST', c.taxId || '—'], ['Gói', c.plan ? `${findPlan(c.plan.code)?.name} · gia hạn ${day(c.plan.renewAt)}` : 'Không'], ['Credit', vnd(Math.max(0, creditOf(db, id)))]].map(([k, v]) => <div key={k} className="bg-white p-2.5 min-w-0"><dt className="text-xs text-ink-3">{k}</dt><dd className="truncate">{v}</dd></div>)}
        </dl>
        <section className="grid gap-2">
          <h3 className="text-sm">Nhãn</h3>
          <div className="flex gap-1.5 flex-wrap items-center">
            {c.tags.map((t) => <span key={t} className="inline-flex items-center gap-1 text-xs border border-line rounded-r px-2 h-7">{t}<button type="button" aria-label={`Bỏ nhãn ${t}`} onClick={() => updateCustomer(id, { tags: c.tags.filter((x) => x !== t) })} className="text-ink-3 hover:text-ink"><Icon name="x" size={12} /></button></span>)}
            <form onSubmit={(e) => { e.preventDefault(); if (tag.trim()) { updateCustomer(id, { tags: [...c.tags, tag.trim()] }); setTag('') } }}><input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="+ Thêm nhãn" className="h-7 w-28 px-2 text-xs border border-dashed border-line rounded-r outline-none" /></form>
          </div>
        </section>
        <label className="grid gap-1.5"><span className="text-sm">Ghi chú nội bộ</span><textarea defaultValue={c.note} onBlur={(e) => updateCustomer(id, { note: e.target.value })} rows={3} placeholder="Sở thích thương hiệu, lưu ý thanh toán…" className="border border-line rounded-r2 p-2.5 text-[13px] outline-none resize-none" /></label>
        <section><h3 className="text-sm mb-2">Đơn hàng ({orders.length})</h3>
          <ul>{orders.map((o) => <li key={o.code} className="border-t border-line first:border-t-0"><a href={`#/admin/viec/${o.code}`} className="flex gap-3 py-2 text-[13px] hover:text-accent"><span className="font-mono text-xs text-ink-3 w-24">{o.code}</span><span className="flex-1 truncate">{findService(o.service)!.name}</span><span className="text-xs text-ink-3">{orderStatusAdmin(o)}</span><span className="tabular-nums w-24 text-right">{vnd(o.price.total)}</span></a></li>)}</ul>
          {orders.length === 0 && <p className="text-[13px] text-ink-3">Chưa có đơn.</p>}
        </section>
        {(() => { const sa = db.sales.find((x) => x.customer === id); return (
          <section><h3 className="text-sm mb-2">Agent bán hàng</h3>
            {sa ? <a href={`#/admin/agent-khach/${id}`} className="block border border-line rounded-r2 p-3 text-[13px] hover:bg-soft">{sa.status === 'live' ? 'Đang chạy' : sa.status === 'paused' ? 'Tạm dừng' : 'Đang thiết lập'} · {sa.conv.toLocaleString('vi-VN')} hội thoại · {sa.leads.length} lead{(sa.help ?? []).some((h) => h.status === 'open') && <span className="block text-xs text-accent">Khách đang nhờ hỗ trợ</span>}</a> : <p className="text-[13px] text-ink-3">Chưa đăng ký.</p>}
          </section>) })()}
        <section><h3 className="text-sm mb-2">Sổ credit</h3>
          {ledger.length === 0 ? <p className="text-[13px] text-ink-3">Chưa có giao dịch.</p> : <ul>{ledger.map((l) => <li key={l.id} className="flex gap-3 py-1.5 text-[13px] border-t border-line first:border-t-0"><span className="font-mono text-xs text-ink-3 w-28">{when(l.t)}</span><span className="flex-1">{l.text}</span><span className={`tabular-nums ${l.delta > 0 ? 'text-ok' : ''}`}>{l.delta > 0 ? '+' : '−'}{vnd(Math.abs(l.delta))}</span></li>)}</ul>}
        </section>
      </aside>
      {credit && (
        <div onClick={(e) => e.stopPropagation()}>
          <Modal title={`Điều chỉnh credit · ${c.name}`} onClose={() => setCredit(false)}>
            <label className="grid gap-1.5 text-[13px]"><span className="text-ink-3">Số tiền (âm để trừ)</span><input value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d-]/g, ''))} inputMode="numeric" className="h-9 px-2.5 border border-line rounded-r font-mono" /></label>
            <label className="grid gap-1.5 text-[13px]"><span className="text-ink-3">Lý do (khách thấy trong sổ credit)</span><input value={why} onChange={(e) => setWhy(e.target.value)} className="h-9 px-2.5 border border-line rounded-r" /></label>
            <div className="flex gap-2 justify-end"><Btn onClick={() => setCredit(false)}>Hủy</Btn><Btn kind="primary" disabled={!Number(amt) || !why.trim()} onClick={() => { adjustCredit(id, Number(amt), why.trim()); setCredit(false) }}>Ghi nhận</Btn></div>
          </Modal>
        </div>
      )}
    </div>
  )
}
