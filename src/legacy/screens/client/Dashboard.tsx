import { findService } from '../../lib/catalog'
import { navigate } from '../../router'
import { orderLabel, stepIndex, STEPS, useStore, useMine, type Mine } from '../../store'
import { Avatar, Bar, Box, Btn, Empty, Icon, Page, PageHead, StatusDot, day, left, vnd, when } from '../../ui'

export function todosOf(db: Mine) {
  const out: { id: string; title: string; sub: string; cta: string; href: string; tone: 'accent' | 'warn' }[] = []
  for (const o of db.orders) {
    if (o.job === 'client_review') out.push({ id: o.code + 'r', title: `Duyệt bản nháp ${findService(o.service)!.short.toLowerCase()} v${o.version}`, sub: `${o.code} · ${o.brand}`, cta: 'Xem bản nháp', href: `#/app/don-hang/${o.code}/ban-nhap`, tone: 'accent' })
    if (o.status === 'awaiting_deposit' || o.status === 'awaiting_final') {
      const p = db.payments.find((x) => x.orderCode === o.code && x.status === 'pending')
      const amt = o.status === 'awaiting_deposit' ? o.price.depositAmount : o.price.total - o.paid
      out.push({ id: o.code + 'p', title: o.status === 'awaiting_deposit' ? `Thanh toán cọc ${findService(o.service)!.short.toLowerCase()}` : 'Thanh toán phần còn lại để mở tệp gốc', sub: `${o.code} · ${vnd(amt)}${p ? ' · mã QR ' + left(p.expiresAt - Date.now()) : ''}`, cta: 'Thanh toán', href: p ? `#/app/thanh-toan/${p.id}` : `#/app/don-hang/${o.code}/thanh-toan`, tone: 'warn' })
    }
  }
  for (const q of db.quotes) if (q.status === 'sent') out.push({ id: q.code, title: `Xem báo giá ${findService(q.service)!.short.toLowerCase()}`, sub: `${q.code} · ${vnd(q.price.total)} · ${left(q.expiresAt - Date.now())}`, cta: 'Xem báo giá', href: `#/app/bao-gia/${q.code}`, tone: 'accent' })
  return out
}

export default function Dashboard() {
  const db = useMine()
  const sa = db.sales
  const todos = todosOf(db).concat(!sa ? [] : [
    ...(sa.terms && !sa.terms.acceptedAt ? [{ id: 'terms', title: 'Xem và chấp nhận điều khoản agent bán hàng', sub: `${vnd(sa.terms.monthly)}/tháng · ${sa.terms.includedConv.toLocaleString('vi-VN')} hội thoại`, cta: 'Xem điều khoản', href: '/app/agent/dieu-khoan', tone: 'accent' as const }] : []),
    ...(sa.knowledge.some((k) => k.status === 'proposed') ? [{ id: 'kb', title: 'Duyệt kiến thức agent đề xuất', sub: `${sa.knowledge.filter((k) => k.status === 'proposed').length} mục chờ duyệt`, cta: 'Duyệt', href: '/app/agent/kien-thuc', tone: 'warn' as const }] : []),
  ])
  const live = db.orders.filter((o) => o.status !== 'canceled' && o.status !== 'awaiting_deposit')
  const acts = db.orders.flatMap((o) => o.events.filter((e) => !e.internal).map((e) => ({ ...e, code: o.code }))).sort((a, b) => b.t - a.t).slice(0, 6)
  const paid = db.payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0)
  const done = db.orders.filter((o) => o.status === 'completed').length
  const empty = db.orders.length === 0 && db.quotes.length === 0

  return (
    <Page>
      <PageHead
        title="Chào chị Hân"
        sub={empty ? 'Quán Mộc An chưa có đơn nào' : todos.length ? `${todos.length} việc cần chị xử lý` : 'Mọi việc đang chạy đúng tiến độ'}
        end={<Btn kind="primary" onClick={() => navigate('/app/chat')}><Icon name="plus" size={14} /> Đặt việc mới</Btn>}
      />

      <Box title="Việc cần bạn làm" count={todos.length}>
        {todos.length === 0 ? (
          <Empty text={empty ? 'Chưa có đơn nào — chat với trợ lý để nhận báo giá trong 3 phút.' : 'Không có việc nào cần bạn lúc này.'} cta={empty && <Btn kind="primary" size="s" onClick={() => navigate('/app/chat')}>Chat với trợ lý</Btn>} />
        ) : (
          <ul>
            {todos.map((t) => (
              <li key={t.id} className="enter flex items-center gap-3 px-4 py-3 border-t border-line first:border-t-0 max-sm:flex-wrap">
                <span className={`size-2 rounded-full flex-none ${t.tone === 'warn' ? 'bg-warn' : 'bg-accent'}`} />
                <div className="flex-1 min-w-0"><p className="text-sm font-medium leading-snug">{t.title}</p><p className="text-[13px] text-ink-3">{t.sub}</p></div>
                <Btn size="s" className="max-sm:w-full" kind={t.tone === 'accent' ? 'primary' : 'ghost'} onClick={() => navigate(t.href)}>{t.cta}</Btn>
              </li>
            ))}
          </ul>
        )}
      </Box>

      <section>
        <div className="flex items-baseline gap-2 mb-2 min-h-7">
          <h2 className="text-sm">Đơn hàng</h2><span className="text-[13px] text-ink-3">{live.length}</span>
          <a href="#/app/don-hang" className="ml-auto text-[13px] font-medium text-accent hover:underline underline-offset-4">Xem tất cả</a>
        </div>
        {live.length === 0 ? <Empty text="Đơn của bạn sẽ hiện ở đây, kèm tiến độ trực tiếp." /> : <OrderTable orders={live.slice(0, 5)} />}
      </section>

      <div className="grid grid-cols-[2fr_1fr] gap-10 max-md:grid-cols-1 max-md:gap-7">
        <section>
          <h2 className="text-sm mb-2 min-h-7">Hoạt động gần đây</h2>
          {acts.length === 0 ? <Empty text="Chưa có hoạt động." /> : (
            <ol>
              {acts.map((a, i) => (
                <li key={a.id} className="grid grid-cols-[72px_14px_1fr] gap-x-2.5 py-2">
                  <time className="font-mono text-xs text-ink-3 pt-px">{when(a.t)}</time>
                  <span className="relative">
                    <span className={`absolute left-1 top-[7px] size-1.5 rounded-full ${i === 0 ? 'bg-accent' : 'bg-[#d4d4d4]'}`} />
                    {i < acts.length - 1 && <span className="absolute left-[6.5px] top-[19px] -bottom-3.5 w-px bg-line" />}
                  </span>
                  <a href={`#/app/don-hang/${a.code}`} className="text-[13px] text-ink-2 hover:text-ink">{a.text} <span className="font-mono text-xs text-ink-3">{a.code}</span></a>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="grid gap-6 content-start">
          <div>
          <div className="flex items-baseline gap-2 mb-2 min-h-7"><h2 className="text-sm">Agent bán hàng</h2><a href="#/app/agent" className="ml-auto text-[13px] font-medium text-accent hover:underline underline-offset-4">{sa ? 'Mở' : 'Tìm hiểu'}</a></div>
          {sa ? (
            <ul className="text-[13px] text-ink-2">
              {[['Trạng thái', sa.status === 'live' ? 'Đang chạy' : sa.status === 'paused' ? 'Tạm dừng' : 'Đang thiết lập'], ['Hội thoại', sa.conv.toLocaleString('vi-VN')], ['Lead mới', String(sa.leads.filter((l) => l.status === 'new').length)]].map(([k, v], i) => (
                <li key={k} className={`flex items-baseline justify-between gap-3 py-2.5 ${i ? 'border-t border-line' : 'pt-1'}`}>{k}<b className="text-sm text-ink tabular-nums">{v}</b></li>
              ))}
            </ul>
          ) : <p className="text-[13px] text-ink-3">Trợ lý trả lời người mua 24/7 trên website, Zalo, Messenger và chuyển lead cho nhân viên của bạn.</p>}
          </div>
          <div>
          <h2 className="text-sm mb-2 min-h-7">Tổng kết</h2>
          <ul className="text-[13px] text-ink-2">
            {[['Đơn hoàn tất', String(done)], ['Đang thực hiện', String(db.orders.filter((o) => o.status === 'active' && o.job !== 'completed').length)], ['Đã thanh toán', vnd(paid)]].map(([k, v], i) => (
              <li key={k} className={`flex items-baseline justify-between gap-3 py-2.5 ${i ? 'border-t border-line' : 'pt-1'}`}>{k}<b className="text-sm text-ink tabular-nums">{v}</b></li>
            ))}
          </ul>
          </div>
        </section>
      </div>
    </Page>
  )
}

export function OrderTable({ orders }: { orders: Mine['orders'] }) {
  return (
    <table className="w-full border-collapse text-[13px]">
      <thead className="max-sm:hidden">
        <tr className="text-left text-xs text-ink-3 [&>th]:font-normal [&>th]:pb-2 [&>th]:px-3 [&>th:first-child]:pl-0 [&>th:last-child]:pr-0 [&>th:last-child]:text-right border-b border-line">
          <th>Đơn</th><th>Phụ trách</th><th>Tiến độ</th><th>Trạng thái</th><th>Hạn giao</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => {
          const s = orderLabel(o), svc = findService(o.service)!
          const pct = Math.round((stepIndex(o) / (STEPS.length - 1)) * 100)
          return (
            <tr key={o.code} onClick={() => navigate(`/app/don-hang/${o.code}`)} className="cursor-pointer hover:bg-side border-b border-line max-sm:grid max-sm:grid-cols-[1fr_auto] max-sm:gap-x-3 max-sm:gap-y-2 max-sm:py-3 [&>td]:py-[11px] [&>td]:px-3 max-sm:[&>td]:p-0 [&>td:first-child]:pl-0 [&>td:last-child]:pr-0">
              <td>
                <a href={`#/app/don-hang/${o.code}`} className="block text-sm font-medium text-ink" onClick={(e) => e.stopPropagation()}>{svc.name}</a>
                <span className="block text-xs text-ink-3"><span className="font-mono">{o.code}</span> · {o.brand}</span>
              </td>
              <td className="max-sm:order-3"><span className="inline-flex items-center gap-2 text-ink-2 whitespace-nowrap"><Avatar id={svc.agent} size={22} />{svc.agent[0].toUpperCase() + svc.agent.slice(1)}</span></td>
              <td className="max-sm:col-span-2 max-sm:order-5"><Bar pct={pct} /></td>
              <td className="max-sm:order-2 max-sm:justify-self-end"><StatusDot status={s.tone}>{s.label}</StatusDot></td>
              <td className="text-right font-mono text-xs text-ink-2 max-sm:order-4 max-sm:justify-self-end">{day(o.dueAt)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
