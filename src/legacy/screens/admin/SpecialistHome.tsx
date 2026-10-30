import { findService } from '../../lib/catalog'
import { navigate } from '../../router'
import { customerName, useStore } from '../../store'
import { Avatar, Btn, Empty, Icon, Page, PageHead, left, when } from '../../ui'

type Item = { k: string; kind: string; title: string; sub: string; due: number; href: string; cta: string }

/** Trang chủ chuyên viên: hàng việc cá nhân xếp theo hạn — không có số liệu tài chính. */
export default function SpecialistHome() {
  const { db } = useStore()
  const now = Date.now()
  const me = db.staff.find((m) => m.id === db.session.member)
  const mine = (r?: string) => !r || r === me?.id
  const items: Item[] = [
    ...db.orders.filter((o) => o.status === 'active' && o.plan?.status === 'pending' && mine(o.reviewer)).map((o) => ({ k: o.code + 'p', kind: 'Duyệt kế hoạch', title: `${o.code} · ${findService(o.service)?.short} ${o.brand}`, sub: `${o.plan!.steps.length} bước do agent điều phối lập`, due: o.plan!.createdAt + 2 * 3600_000, href: '#/admin/duyet', cta: 'Duyệt' })),
    ...db.orders.filter((o) => o.job === 'pending_approval' && mine(o.reviewer)).map((o) => ({ k: o.code, kind: 'Duyệt bản nháp', title: `${o.code} · ${findService(o.service)?.short} ${o.brand}`, sub: `Bản v${o.version} đã qua QC của Lan`, due: o.lastStep + 2 * 3600_000, href: `#/admin/duyet/${o.code}`, cta: 'Duyệt' })),
    ...db.threads.filter((t) => (t.handoff || t.takeover) && t.unread > 0).map((t) => ({ k: t.id, kind: 'Khách chờ trả lời', title: customerName(db, t.customer), sub: t.messages.at(-1)?.text.slice(0, 80) ?? '', due: (t.messages.at(-1)?.t ?? now) + 15 * 60_000, href: `#/admin/hop-thu/${t.id}`, cta: 'Trả lời' })),
    ...db.actions.filter((r) => r.status === 'pending').map((r) => ({ k: r.id, kind: 'Agent xin phép', title: `${r.action} · ${r.orderCode}`, sub: r.detail, due: r.t + 30 * 60_000, href: '#/admin/duyet', cta: 'Xem' })),
    ...db.orders.filter((o) => o.capHit && o.status === 'active').map((o) => ({ k: o.code + 'cap', kind: 'Chạm trần chi phí', title: `${o.code} · ${o.brand}`, sub: 'Agent đang dừng — báo admin nới trần hoặc chuyển đối tác', due: o.lastStep, href: `#/admin/viec/${o.code}`, cta: 'Xem' })),
    ...db.orders.filter((o) => o.job === 'input_required' && o.input && now - o.input.t > 30 * 60_000).map((o) => ({ k: o.code + 'in', kind: 'Khách chưa trả lời agent', title: `${o.code} · ${o.brand}`, sub: o.input!.q, due: o.input!.t + 2 * 3600_000, href: `#/admin/viec/${o.code}`, cta: 'Gọi khách' })),
    ...db.orders.filter((o) => o.job === 'on_hold' && !o.offerId).map((o) => ({ k: o.code + 'h', kind: 'Việc tạm dừng', title: `${o.code} · ${o.brand}`, sub: 'Cần quyết định tiếp tục hoặc liên hệ khách', due: o.dueAt, href: `#/admin/viec/${o.code}`, cta: 'Xem' })),
    ...db.sales.flatMap((s) => (s.help ?? []).filter((h) => h.status === 'open').map((h) => ({ k: h.id, kind: 'Khách nhờ hỗ trợ agent', title: customerName(db, s.customer), sub: h.text, due: h.t + 4 * 3600_000, href: `#/admin/agent-khach/${s.customer}`, cta: 'Hỗ trợ' }))),
    ...db.offers.filter((o) => o.status === 'delivered').map((o) => ({ k: o.id, kind: 'QC bài đối tác', title: o.title, sub: o.delivery?.note ?? '', due: o.dueAt, href: `#/admin/doi-tac/${o.id}`, cta: 'QC' })),
  ].sort((a, b) => a.due - b.due)
  const doneToday = db.orders.flatMap((o) => o.events).filter((e) => e.actor === 'owner' && new Date(e.t).toDateString() === new Date().toDateString()).length
  const late = items.filter((i) => i.due < now).length
  return (
    <Page max={1080}>
      <PageHead title={`Chào ${me?.name ?? 'bạn'}`} sub={items.length ? `${items.length} việc cần bạn · ${late ? `${late} việc quá hạn SLA` : 'chưa có việc quá hạn'}` : 'Hàng việc trống — agent đang tự chạy.'} end={<Btn onClick={() => navigate('/admin/trung-tam-agent')}><Icon name="spark" size={14} /> Xem agent đang làm gì</Btn>} />
      <dl className="grid grid-cols-3 border border-line rounded-r2 divide-x divide-line [&>div]:p-4">
        <div><dt className="text-xs text-ink-3">Cần xử lý</dt><dd className="text-2xl font-medium tabular-nums">{items.length}</dd></div>
        <div><dt className="text-xs text-ink-3">Quá hạn SLA</dt><dd className={`text-2xl font-medium tabular-nums ${late ? 'text-red-600' : ''}`}>{late}</dd></div>
        <div><dt className="text-xs text-ink-3">Bạn đã xử lý hôm nay</dt><dd className="text-2xl font-medium tabular-nums">{doneToday}</dd></div>
      </dl>
      <section className="grid gap-2">
        <h2 className="text-sm">Hàng việc của tôi</h2>
        {items.length === 0 ? <div className="border border-line rounded-r2"><Empty text="Không có việc nào cần bạn. Khi agent cần người duyệt hoặc khách cần người thật, việc sẽ hiện ở đây." /></div> : (
          <ul className="border border-line rounded-r2 divide-y divide-line">
            {items.map((i) => (
              <li key={i.k} className="flex items-center gap-3 px-4 py-3 max-sm:flex-wrap">
                <span className={`text-xs w-32 shrink-0 ${i.kind.startsWith('Khách') ? 'text-accent font-medium' : 'text-ink-3'}`}>{i.kind}</span>
                <div className="flex-1 min-w-0"><p className="text-[13px] font-medium truncate">{i.title}</p><p className="text-xs text-ink-3 truncate">{i.sub}</p></div>
                <span className={`font-mono text-xs w-24 text-right ${i.due < now ? 'text-red-600' : 'text-ink-3'}`}>{i.due < now ? 'quá hạn' : left(i.due - now)}</span>
                <Btn size="s" kind="primary" onClick={() => navigate(i.href)}>{i.cta}</Btn>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="grid gap-2">
        <h2 className="text-sm">Đội agent bạn giám sát</h2>
        <ul className="flex flex-wrap gap-2">
          {(['mai', 'khoa', 'minh', 'lan'] as const).map((id) => {
            const a = db.agents.find((x) => x.id === id)!
            const n = db.orders.filter((o) => o.status === 'active' && (id === 'lan' ? ['submitted', 'qc_review'].includes(o.job) : findService(o.service)?.agent === id && ['running', 'revision_requested'].includes(o.job))).length
            return <li key={id} className="border border-line rounded-r2 px-3 py-2 flex items-center gap-2 text-[13px]"><Avatar id={id} size={22} />{a.name}<span className="text-xs text-ink-3">{!a.enabled ? 'đã tắt' : n ? `${n} việc` : 'rảnh'}</span></li>
          })}
        </ul>
        <p className="text-xs text-ink-3">Bật/tắt agent, đổi model, chi phí và tài chính do admin quản lý. Cập nhật {when(now)}.</p>
      </section>
    </Page>
  )
}
