import { useState } from 'react'
import { findPlan, PLANS } from '../../lib/catalog'
import { navigate } from '../../router'
import { useMine, useStore } from '../../store'
import { Btn, Empty, Icon, Modal, Page, PageHead, day, vnd, when } from '../../ui'

/** C-15: gói hiện tại, so sánh gói, biểu đồ dùng credit, sổ credit. */
export default function Plans() {
  const me = useMine()
  const { buyPlan, cancelPlan } = useStore()
  const [stop, setStop] = useState(false)
  const cur = me.customer.plan ? findPlan(me.customer.plan.code) : undefined
  const spent = me.ledger.filter((l) => l.delta < 0).reduce((s, l) => s - l.delta, 0)
  const added = me.ledger.filter((l) => l.delta > 0).reduce((s, l) => s + l.delta, 0)
  // last 6 weeks of credit usage
  const weeks = Array.from({ length: 6 }, (_, i) => {
    const end = Date.now() - (5 - i) * 7 * 864e5, start = end - 7 * 864e5
    return { label: day(start), v: me.ledger.filter((l) => l.delta < 0 && l.t > start && l.t <= end).reduce((s, l) => s - l.delta, 0) }
  })
  const max = Math.max(1, ...weeks.map((w) => w.v))

  return (
    <Page>
      <PageHead title="Gói & credit" sub="Trả trước theo tháng, nhận credit nhiều hơn số tiền trả — dùng cho mọi dịch vụ." />

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-6 max-lg:grid-cols-1">
        <section className="border border-line rounded-r2 p-5 grid gap-4 content-start">
          <div className="flex items-baseline gap-2"><p className="text-xs text-ink-3">Số dư credit</p>{cur && <span className="ml-auto text-xs text-ink-3">Gói {cur.name} · gia hạn {day(me.customer.plan!.renewAt)}</span>}</div>
          <p className="text-3xl font-medium tabular-nums">{vnd(Math.max(0, me.credit))}</p>
          <div className="h-1.5 rounded-sm bg-hover overflow-hidden"><i className="block h-full bg-accent" style={{ width: `${added ? Math.min(100, (Math.max(0, me.credit) / added) * 100) : 0}%` }} /></div>
          <p className="text-xs text-ink-3">Đã dùng {vnd(spent)} trên tổng {vnd(added)} đã nạp</p>
          {me.credit <= 0 && <p className="text-[13px] bg-warn/10 rounded-r px-3 py-2">Credit đã hết — đơn mới sẽ thanh toán bằng VietQR.</p>}
          {cur ? <div className="flex gap-2"><Btn kind="primary" onClick={() => navigate(`/app/thanh-toan/${buyPlan(cur.code)}`)}>Gia hạn sớm</Btn><Btn kind="plain" onClick={() => setStop(true)}>Hủy gia hạn</Btn></div> : <p className="text-[13px] text-ink-3">Chị chưa có gói tháng. Chọn một gói bên dưới để tiết kiệm đến 17%.</p>}
        </section>
        <section className="border border-line rounded-r2 p-5 grid gap-3">
          <h2 className="text-sm">Credit đã dùng theo tuần</h2>
          <div className="flex items-end gap-3 h-36 pt-2" role="img" aria-label="Biểu đồ credit đã dùng 6 tuần gần nhất">
            {weeks.map((w) => (
              <div key={w.label} className="flex-1 grid gap-1.5 justify-items-center h-full content-end">
                <span className="text-[11px] font-mono text-ink-3">{w.v ? Math.round(w.v / 1000) + 'k' : ''}</span>
                <span className={`w-full max-w-10 rounded-t ${w.v ? 'bg-accent' : 'bg-hover'}`} style={{ height: `${Math.max(4, (w.v / max) * 100)}%` }} />
                <span className="text-[11px] font-mono text-ink-3">{w.label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="grid gap-3">
        <h2 className="text-sm">Các gói</h2>
        <ul className="grid grid-cols-3 max-lg:grid-cols-1 gap-3">
          {PLANS.map((p, i) => {
            const isCur = cur?.code === p.code
            return (
              <li key={p.code} className={`border rounded-r2 p-5 grid gap-3 content-start ${i === 1 ? 'border-accent' : 'border-line'}`}>
                <div className="flex items-center gap-2"><h3 className="text-base">{p.name}</h3>{i === 1 && <span className="text-xs text-accent font-medium">Phổ biến</span>}{isCur && <span className="ml-auto text-xs text-ok inline-flex items-center gap-1"><Icon name="check" size={13} /> Đang dùng</span>}</div>
                <p><span className="text-2xl font-medium tabular-nums">{vnd(p.price)}</span><span className="text-[13px] text-ink-3"> / tháng</span></p>
                <p className="text-[13px]">Nhận <b>{vnd(p.credit)}</b> credit <span className="text-ok">(+{Math.round((p.credit / p.price - 1) * 100)}%)</span></p>
                <ul className="grid gap-1.5 text-[13px] text-ink-2">{p.perks.map((x) => <li key={x} className="flex gap-2"><Icon name="check" size={14} className="text-ink-3 mt-0.5" />{x}</li>)}</ul>
                <Btn kind={i === 1 ? 'primary' : 'ghost'} disabled={isCur} onClick={() => navigate(`/app/thanh-toan/${buyPlan(p.code)}`)}>{isCur ? 'Gói hiện tại' : cur ? 'Đổi sang gói này' : 'Chọn gói'}</Btn>
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <h2 className="text-sm mb-2">Sổ credit</h2>
        {me.ledger.length === 0 ? <Empty text="Chưa có giao dịch credit." /> : (
          <table className="w-full text-[13px] border-collapse">
            <thead><tr className="text-left text-xs text-ink-3 border-b border-line [&>th]:font-normal [&>th]:pb-2"><th>Thời gian</th><th>Nội dung</th><th className="text-right">Thay đổi</th></tr></thead>
            <tbody>{me.ledger.slice().sort((a, b) => b.t - a.t).map((l) => (
              <tr key={l.id} className="border-b border-line [&>td]:py-2.5"><td className="font-mono text-xs text-ink-3 w-36">{when(l.t)}</td><td>{l.orderCode ? <a href={`#/app/don-hang/${l.orderCode}`} className="hover:underline underline-offset-4">{l.text}</a> : l.text}</td><td className={`text-right font-mono tabular-nums ${l.delta > 0 ? 'text-ok' : ''}`}>{l.delta > 0 ? '+' : '−'}{vnd(Math.abs(l.delta))}</td></tr>
            ))}</tbody>
          </table>
        )}
      </section>

      {stop && (
        <Modal title="Hủy gia hạn gói?" onClose={() => setStop(false)}>
          <p className="text-[13px] text-ink-2">Credit còn lại {vnd(Math.max(0, me.credit))} vẫn dùng được đến hết kỳ. Gói sẽ không tự gia hạn.</p>
          <div className="flex gap-2 justify-end"><Btn onClick={() => setStop(false)}>Giữ gói</Btn><Btn kind="primary" onClick={() => { cancelPlan(); setStop(false) }}>Hủy gia hạn</Btn></div>
        </Modal>
      )}
    </Page>
  )
}
