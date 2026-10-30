import { useState, useTransition } from 'react'
import { settleManagedPayment } from '@/app/(frontend)/actions/payment'
import { CATALOG, findService, type ServiceCode } from '../../lib/catalog'
import { canStaff, customerName, useStore } from '../../store'
import { Btn, Empty, Page, PageHead, day, vnd, when } from '../../ui'

// Ước tính chi phí theo dịch vụ: model (LLM) + tool (Seedance, hosting) + phí cổng (payOS miễn phí; SePay ~300đ/gd).
const MODEL: Record<ServiceCode, number> = { logo: 0.05, post: 0.05, video: 0.04, landing: 0.07 }
const TOOL: Record<ServiceCode, number> = { logo: 0.03, post: 0.02, video: 0.12, landing: 0.03 }
const RANGES = [{ d: 7, l: '7 ngày' }, { d: 30, l: '30 ngày' }, { d: 90, l: '90 ngày' }]
type Group = 'service' | 'customer'

/** A-09: doanh thu, chi phí model/tool, phí cổng, biên lãi; nhóm theo dịch vụ hoặc khách. */
export default function Finance() {
  const { db, markPaid } = useStore()
  const [range, setRange] = useState(30)
  const [group, setGroup] = useState<Group>('service')
  const [settling, startSettling] = useTransition()
  const [settleError, setSettleError] = useState('')
  const since = Date.now() - range * 864e5
  const fee = db.settings.gateway === 'SePay' ? 300 : 0
  const pays = db.payments.filter((p) => p.status === 'paid' && p.method === 'qr' && (p.paidAt ?? 0) >= since)
  const orderOf = (code?: string) => db.orders.find((o) => o.code === code)
  const lines = pays.map((p) => {
    const o = orderOf(p.orderCode), s = o?.service
    const model = s ? p.amount * MODEL[s] : 0, tool = s ? p.amount * TOOL[s] : 0
    return { p, o, s, model, tool, fee, net: p.amount - model - tool - fee }
  })
  const rev = lines.reduce((a, l) => a + l.p.amount, 0), model = lines.reduce((a, l) => a + l.model, 0), tool = lines.reduce((a, l) => a + l.tool, 0), fees = lines.length * fee
  const net = rev - model - tool - fees
  const budgetPct = rev ? ((model + tool) / rev) * 100 : 0
  const pendingPayments = db.payments.filter((payment) => payment.status === 'pending' && payment.method === 'qr').sort((a, b) => a.expiresAt - b.expiresAt)

  const bucketDays = range <= 7 ? 1 : range <= 30 ? 3 : 10
  const buckets = Array.from({ length: Math.ceil(range / bucketDays) }, (_, i) => {
    const start = since + i * bucketDays * 864e5, end = start + bucketDays * 864e5
    const ls = lines.filter((l) => l.p.paidAt! >= start && l.p.paidAt! < end)
    return { label: day(start), rev: ls.reduce((a, l) => a + l.p.amount, 0), cost: ls.reduce((a, l) => a + l.model + l.tool + l.fee, 0) }
  })
  const max = Math.max(1, ...buckets.map((b) => b.rev))

  const groups = group === 'service'
    ? CATALOG.map((s) => ({ k: s.code, label: s.name, ls: lines.filter((l) => l.s === s.code) }))
    : db.customers.map((c) => ({ k: c.id, label: c.name || 'Khách mới', ls: lines.filter((l) => l.p.customer === c.id) }))
  const rowsG = groups.map((g) => {
    const r = g.ls.reduce((a, l) => a + l.p.amount, 0), c = g.ls.reduce((a, l) => a + l.model + l.tool + l.fee, 0)
    return { ...g, r, c, m: r ? Math.round(((r - c) / r) * 100) : 0 }
  }).filter((g) => g.r > 0).sort((a, b) => b.r - a.r)

  return (
    <Page max={1280}>
      <PageHead title="Tài chính" sub="Doanh thu là tiền thật đã nhận qua VietQR (không tính credit đã tiêu). Chi phí là ước tính theo tầng model."
        end={<div role="group" className="flex p-0.5 gap-0.5 border border-line rounded-r">{RANGES.map((r) => <button key={r.d} type="button" aria-pressed={range === r.d} onClick={() => setRange(r.d)} className={`h-7 max-md:h-10 px-3 rounded text-xs ${range === r.d ? 'bg-hover font-medium' : 'text-ink-2'}`}>{r.l}</button>)}</div>} />

      <dl className="grid grid-cols-5 max-lg:grid-cols-2 gap-px bg-line border border-line rounded-r2 overflow-hidden">
        {[['Doanh thu', vnd(rev), `${pays.length} giao dịch`], ['Chi phí model', vnd(Math.round(model)), 'LLM theo tầng'], ['Chi phí tool', vnd(Math.round(tool)), 'Seedance, hosting'], ['Phí cổng', vnd(fees), db.settings.gateway], ['Lãi gộp', vnd(Math.round(net)), rev ? `${Math.round((net / rev) * 100)}% doanh thu` : '—']].map(([k, v, s]) => (
          <div key={k} className="bg-white p-4 grid gap-1"><dt className="text-xs text-ink-3">{k}</dt><dd className="text-xl font-medium tabular-nums">{v}</dd><dd className="text-xs text-ink-3">{s}</dd></div>
        ))}
      </dl>

      <section className={`flex items-center gap-3 px-4 py-3 rounded-r2 text-[13px] ${budgetPct > db.settings.modelBudgetPct ? 'bg-warn/10' : 'bg-soft'}`}>
        <span className="flex-1">Chi phí model + tool chiếm <b>{budgetPct.toFixed(1)}%</b> doanh thu · trần cài đặt {db.settings.modelBudgetPct}%</span>
        <div className="w-48 h-1.5 bg-white rounded-sm overflow-hidden"><i className={`block h-full ${budgetPct > db.settings.modelBudgetPct ? 'bg-warn' : 'bg-accent'}`} style={{ width: `${Math.min(100, (budgetPct / Math.max(1, db.settings.modelBudgetPct * 1.5)) * 100)}%` }} /></div>
      </section>

      {pendingPayments.length > 0 && <section className="grid gap-2">
        <div className="flex items-baseline gap-2"><h2 className="text-sm">Chờ đối soát</h2><span className="text-xs text-ink-3">{pendingPayments.length} giao dịch</span></div>
        {settleError && <p role="alert" className="text-xs text-warn bg-warn/10 rounded-r px-3 py-2">{settleError}</p>}
        <ul className="border border-line rounded-r2 divide-y divide-line">{pendingPayments.map((payment) => (
          <li key={payment.id} className="flex items-center gap-3 px-4 py-3 max-sm:flex-wrap">
            <div className="flex-1 min-w-0"><p className="text-[13px] font-medium">{customerName(db, payment.customer)} · {payment.orderCode ?? 'Gói tháng'}</p><p className="text-xs text-ink-3"><span className="font-mono">{payment.ref}</span> · hết hạn {when(payment.expiresAt)}</p></div>
            <span className="font-mono text-[13px] tabular-nums">{vnd(payment.amount)}</span>
            {canStaff(db, 'finance.manage') && <Btn size="s" kind="primary" disabled={settling} onClick={() => startSettling(async () => {
              setSettleError('')
              const result = await settleManagedPayment(payment.id)
              if (!result.ok) { setSettleError(result.error); return }
              markPaid(payment.id)
            })}>Xác nhận đã nhận</Btn>}
          </li>
        ))}</ul>
      </section>}

      <section className="grid gap-3">
        <div className="flex items-center gap-4 text-xs text-ink-3"><h2 className="text-sm text-ink mr-auto">Doanh thu & chi phí</h2><span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-sm bg-accent" />Doanh thu</span><span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-sm bg-ink-3" />Chi phí</span></div>
        {rev === 0 ? <Empty text="Không có doanh thu trong kỳ này." /> : (
          <div className="flex items-end gap-1.5 h-48 border-b border-line" role="img" aria-label="Biểu đồ doanh thu và chi phí">
            {buckets.map((b, i) => (
              <div key={i} className="flex-1 h-full grid content-end gap-1 group relative">
                <div className="flex items-end gap-0.5 h-full">
                  <span className="flex-1 bg-accent rounded-t-sm transition-[height]" style={{ height: `${(b.rev / max) * 100}%` }} />
                  <span className="flex-1 bg-ink-3/60 rounded-t-sm" style={{ height: `${(b.cost / max) * 100}%` }} />
                </div>
                {b.rev > 0 && <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[11px] font-mono bg-ink text-white rounded px-1.5 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none">{vnd(b.rev)}</span>}
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-1.5 text-[11px] font-mono text-ink-3">{buckets.map((b, i) => <span key={i} className="flex-1 text-center truncate">{i % Math.ceil(buckets.length / 8) === 0 ? b.label : ''}</span>)}</div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-8 max-lg:grid-cols-1">
        <section>
          <div className="flex items-baseline gap-2 mb-2"><h2 className="text-sm">Theo {group === 'service' ? 'dịch vụ' : 'khách hàng'}</h2>
            <div className="ml-auto flex gap-1">{(['service', 'customer'] as Group[]).map((g) => <button key={g} type="button" aria-pressed={group === g} onClick={() => setGroup(g)} className={`h-7 px-2.5 rounded-r text-xs ${group === g ? 'bg-hover font-medium' : 'text-ink-2'}`}>{g === 'service' ? 'Dịch vụ' : 'Khách'}</button>)}</div>
          </div>
          <table className="w-full text-[13px] border-collapse">
            <thead><tr className="text-left text-xs text-ink-3 border-b border-line [&>th]:font-normal [&>th]:py-2"><th></th><th className="text-right">Doanh thu</th><th className="text-right">Chi phí</th><th className="text-right">Biên</th></tr></thead>
            <tbody>{rowsG.map((g) => <tr key={g.k} className="border-b border-line [&>td]:py-2.5"><td>{g.label}</td><td className="text-right tabular-nums">{vnd(g.r)}</td><td className="text-right tabular-nums text-ink-3">{vnd(Math.round(g.c))}</td><td className={`text-right tabular-nums ${g.m < 80 ? 'text-warn' : ''}`}>{g.m}%</td></tr>)}</tbody>
          </table>
        </section>
        <section>
          <h2 className="text-sm mb-2">Giao dịch gần đây</h2>
          <ul>{lines.slice().sort((a, b) => b.p.paidAt! - a.p.paidAt!).slice(0, 8).map((l) => (
            <li key={l.p.id} className="flex gap-3 py-2 border-b border-line text-[13px]"><span className="font-mono text-xs text-ink-3 w-28">{when(l.p.paidAt!)}</span><span className="flex-1 truncate">{customerName(db, l.p.customer)} · {l.s ? findService(l.s)!.short : 'Gói tháng'}</span><span className="font-mono text-xs text-ink-3">{l.p.ref}</span><span className="tabular-nums w-24 text-right">{vnd(l.p.amount)}</span></li>
          ))}</ul>
        </section>
      </div>
    </Page>
  )
}
