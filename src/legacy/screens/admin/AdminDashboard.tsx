import { findService } from '../../lib/catalog'
import { adminLabel, useStore } from '../../store'
import { Box, Empty, Icon, Page, PageHead, vnd, when } from '../../ui'

// Ước tính chi phí model/tool theo tầng (handoff §2: ngân sách ~10–15% giá job)
const COST_PCT = { logo: 0.08, post: 0.07, video: 0.16, landing: 0.1 }

export default function AdminDashboard() {
  const { db } = useStore()
  const paid = db.payments.filter((p) => p.status === 'paid')
  const revenue = paid.reduce((s, p) => s + p.amount, 0)
  const today = paid.filter((p) => new Date(p.paidAt!).toDateString() === new Date().toDateString()).reduce((s, p) => s + p.amount, 0)
  const live = db.orders.filter((o) => o.status !== 'canceled')
  const cost = live.reduce((s, o) => s + o.price.total * COST_PCT[o.service], 0)
  const sales = live.reduce((s, o) => s + o.price.total, 0)
  const margin = sales ? Math.round(((sales - cost) / sales) * 100) : 0
  const pending = db.orders.filter((o) => o.job === 'pending_approval')
  const cols: [string, string[]][] = [['Xếp hàng', ['queued', 'offered', 'assigned']], ['Đang chạy', ['running', 'revision_requested', 'input_required']], ['Kiểm tra', ['submitted', 'qc_review']], ['Chờ duyệt', ['pending_approval']], ['Khách duyệt', ['client_review']], ['Hoàn tất', ['accepted', 'completed']]]
  const active = db.orders.filter((o) => o.status !== 'awaiting_deposit' && o.status !== 'canceled')
  const alerts = [
    ...pending.map((o) => ({ k: o.code, text: `${o.code} chờ duyệt bản v${o.version}`, href: `#/admin/duyet/${o.code}` })),
    ...db.threads.filter((t) => (t.handoff || t.takeover) && t.unread > 0).map((t) => ({ k: 'h' + t.id, text: `${db.customers.find((c) => c.id === t.customer)?.name} đang chờ chuyên viên trả lời`, href: `#/admin/hop-thu/${t.id}` })),
    ...db.orders.filter((o) => o.status === 'active' && o.plan?.status === 'pending').map((o) => ({ k: o.code + 'pl', text: `${o.code} có kế hoạch chờ duyệt`, href: `#/admin/duyet` })),
    ...db.actions.filter((r) => r.status === 'pending').map((r) => ({ k: 'ac' + r.id, text: `Agent xin phép: ${r.action} (${r.orderCode})`, href: '#/admin/duyet' })),
    ...db.orders.filter((o) => o.capHit && o.status === 'active').map((o) => ({ k: 'ch' + o.code, text: `${o.code} chạm trần chi phí job`, href: `#/admin/viec/${o.code}` })),
    ...db.offers.filter((o) => o.status === 'delivered').map((o) => ({ k: 'of' + o.id, text: `Đối tác đã giao ${o.id} — cần QC`, href: `#/admin/doi-tac/${o.id}` })),
    ...db.providers.filter((p) => p.status === 'pending').map((p) => ({ k: 'pv' + p.id, text: `Hồ sơ đối tác ${p.name} chờ duyệt`, href: '#/admin/doi-tac/doi-tac' })),
    ...db.runtimes.filter((r) => r.status === 'paused').map((r) => ({ k: 'rt' + r.id, text: `Runtime ${r.name} đang dừng khẩn cấp`, href: '#/admin/agent' })),
    ...db.agents.filter((a) => a.spentToday >= a.capDay * 0.8).map((a) => ({ k: 'cap' + a.id, text: `${a.name} đã dùng ${Math.round((a.spentToday / a.capDay) * 100)}% trần chi phí ngày`, href: '#/admin/agent' })),
    ...db.sales.filter((a) => a.termsRequested).map((a) => ({ k: 'tm' + a.customer, text: `${db.customers.find((c) => c.id === a.customer)?.name} chờ điều khoản agent bán hàng`, href: '#/admin/agent-khach' })),
    ...db.orders.filter((o) => o.job === 'on_hold').map((o) => ({ k: o.code + 'h', text: `${o.code} đang tạm dừng`, href: `#/admin/viec/${o.code}` })),
  ]
  const ANNUAL_CAP = 1_000_000_000

  return (
    <Page max={1180}>
      <PageHead title="Tổng quan studio" sub="Số liệu cập nhật trực tiếp từ đơn và thanh toán" />
      <dl className="grid grid-cols-4 max-lg:grid-cols-2 border border-line rounded-r2 divide-x divide-line max-lg:divide-x-0 max-lg:[&>div:nth-child(odd)]:border-r max-lg:[&>div:nth-child(-n+2)]:border-b [&>div]:border-line">
        {[
          ['Doanh thu hôm nay', vnd(today), `Tổng đã thu ${vnd(revenue)}`],
          ['Chờ duyệt', String(pending.length), pending.length ? 'Cần xử lý trong SLA 2 giờ' : 'Không có gì tồn'],
          ['Biên lãi gộp ước tính', `${margin}%`, `Chi phí model ~${vnd(Math.round(cost))}`],
          ['Ngưỡng 1 tỷ/năm (HKD)', `${((revenue / ANNUAL_CAP) * 100).toFixed(2)}%`, 'Theo dõi để chuyển mô hình thuế'],
        ].map(([k, v, s]) => (
          <div key={k} className="p-4 grid gap-1"><dt className="text-xs text-ink-3">{k}</dt><dd className="text-2xl font-medium tabular-nums">{v}</dd><dd className="text-xs text-ink-3">{s}</dd></div>
        ))}
      </dl>

      <section>
        <div className="flex items-baseline gap-2 mb-2 min-h-7"><h2 className="text-sm">Việc theo trạng thái</h2><a href="#/admin/viec" className="ml-auto text-[13px] font-medium text-accent hover:underline underline-offset-4">Mở bảng việc</a></div>
        <ul className="grid grid-cols-6 max-md:grid-cols-3 gap-2">
          {cols.map(([k, states]) => {
            const n = active.filter((o) => states.includes(o.job)).length
            return <li key={k} className="border border-line rounded-r2 p-3"><p className="text-xs text-ink-3">{k}</p><p className={`text-xl font-medium tabular-nums ${k === 'Chờ duyệt' && n ? 'text-accent' : ''}`}>{n}</p></li>
          })}
        </ul>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 max-lg:grid-cols-1">
        <Box title="Cảnh báo" count={alerts.length}>
          {alerts.length === 0 ? <Empty text="Không có cảnh báo. Mọi việc đang chạy ổn." /> : (
            <ul>{alerts.map((a) => <li key={a.k} className="border-t border-line first:border-t-0"><a href={a.href} className="flex items-center gap-3 px-4 py-3 hover:bg-side text-[13px]"><span className="size-2 rounded-full bg-warn" />{a.text}<Icon name="arrow" size={14} className="ml-auto text-ink-3" /></a></li>)}</ul>
          )}
        </Box>
        <Box title="Agent & runtime" action={<a href="#/admin/agent" className="text-[13px] font-medium text-accent">Quản lý</a>}>
          <ul>
            {db.runtimes.map((r) => (
              <li key={r.id} className="border-t border-line first:border-t-0 flex items-center gap-3 px-4 py-2.5 text-[13px]">
                <span className={`size-2 rounded-full ${r.status === 'connected' ? 'bg-ok' : r.status === 'paused' ? 'bg-red-500' : 'bg-idle'}`} />
                <span className="flex-1">{r.name}</span>
                <span className="text-xs text-ink-3">{db.agents.filter((a) => a.runtime === r.id && a.enabled).length} agent{r.status === 'connected' && ` · ${r.latencyMs}ms`}</span>
              </li>
            ))}
            <li className="border-t border-line flex items-center gap-3 px-4 py-2.5 text-[13px]"><span className="flex-1 text-ink-2">Chi phí agent hôm nay</span><span className="font-mono text-xs">{vnd(db.agents.reduce((s, a) => s + a.spentToday, 0))}</span></li>
            <li className="border-t border-line flex items-center gap-3 px-4 py-2.5 text-[13px]"><span className="flex-1 text-ink-2">Agent bán hàng đang chạy</span><span className="font-mono text-xs">{db.sales.filter((a) => a.status === 'live').length}/{db.sales.length}</span></li>
          </ul>
        </Box>
        <Box title="Đơn gần đây">
          <ul>
            {db.orders.slice(0, 6).map((o) => (
              <li key={o.code} className="border-t border-line first:border-t-0"><a href={`#/admin/viec/${o.code}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-side">
                <div className="flex-1 min-w-0"><p className="text-[13px] font-medium">{findService(o.service)!.name} · {o.brand}</p><p className="text-xs text-ink-3"><span className="font-mono">{o.code}</span> · {when(o.createdAt)}</p></div>
                <span className="text-xs text-ink-2">{o.status === 'awaiting_deposit' ? 'Chờ cọc' : adminLabel(o.job)}</span>
                <span className="font-mono text-xs tabular-nums w-24 text-right">{vnd(o.price.total)}</span>
              </a></li>
            ))}
          </ul>
        </Box>
      </div>
    </Page>
  )
}
