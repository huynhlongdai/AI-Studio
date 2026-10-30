import { useState } from 'react'
import { CATALOG, findService, type ServiceCode } from '../../lib/catalog'
import { navigate } from '../../router'
import { canStaff, providerName, useStore, type Offer, type Provider } from '../../store'
import { Btn, Modal, Page, PageHead, Tabs, day, vnd, when } from '../../ui'

export const OFFER_ST: Record<Offer['status'], string> = { open: 'Đang mở nhận ứng tuyển', accepted: 'Đối tác đang làm', delivered: 'Đã giao, chờ QC', approved: 'Đạt QC', canceled: 'Đã hủy' }
const P_ST: Record<Provider['status'], [string, string]> = { active: ['Đang hoạt động', 'bg-ok'], pending: ['Chờ duyệt hồ sơ', 'bg-warn'], suspended: ['Tạm khóa', 'bg-red-500'] }
export const ratingOf = (offers: Offer[], id: string) => { const r = offers.filter((o) => o.provider === id && o.rating); return r.length ? r.reduce((s, o) => s + o.rating!, 0) / r.length : 0 }

/** Marketplace (phase 3): đẩy việc cho đối tác ngoài, chọn người, QC, chấm điểm, chi trả. */
export default function Partners({ id, tab: t0 }: { id?: string; tab?: string }) {
  const { db } = useStore()
  if (id && db.offers.some((o) => o.id === id)) return <OfferDetail id={id} />
  const tab = (['viec', 'doi-tac', 'chi-tra'].includes(t0 ?? '') ? t0 : 'viec') as 'viec' | 'doi-tac' | 'chi-tra'
  const canManage = canStaff(db, 'partners.manage')
  const canPayout = canStaff(db, 'partners.payout')
  const due = db.offers.filter((o) => o.payout?.status === 'pending').reduce((s, o) => s + o.payout!.amount, 0)
  return (
    <Page max={1180}>
      <PageHead title="Đối tác & marketplace" sub={`${db.providers.filter((p) => p.status === 'active').length} đối tác hoạt động · ${db.offers.filter((o) => o.status === 'open').length} việc đang mở · chờ chi trả ${vnd(due)}`} end={canManage && <PostBtn />} />
      <Tabs value={tab} onChange={(v) => navigate(`/admin/doi-tac/${v}`)} items={[
        { id: 'viec', label: `Việc (${db.offers.length})` },
        { id: 'doi-tac', label: <>Đối tác{db.providers.some((p) => p.status === 'pending') && <span className="ml-1.5 font-mono text-[11px] bg-accent text-white rounded px-1">{db.providers.filter((p) => p.status === 'pending').length}</span>}</> },
        ...(canPayout ? [{ id: 'chi-tra' as const, label: 'Chi trả' }] : []),
      ]} />
      {tab === 'viec' && <OfferList />}
      {tab === 'doi-tac' && <ProviderList />}
      {tab === 'chi-tra' && canPayout && <Payouts />}
    </Page>
  )
}

function OfferList() {
  const { db } = useStore()
  const [f, setF] = useState<'all' | Offer['status']>('all')
  const list = db.offers.filter((o) => f === 'all' || o.status === f)
  return (
    <div className="grid gap-3">
      <div className="flex gap-1.5 flex-wrap">{(['all', 'open', 'accepted', 'delivered', 'approved'] as const).map((s) => <button key={s} type="button" onClick={() => setF(s)} className={`text-[13px] px-2.5 min-h-8 rounded-r border ${f === s ? 'border-ink text-ink' : 'border-line text-ink-3'}`}>{s === 'all' ? 'Tất cả' : OFFER_ST[s]} <span className="font-mono text-xs">{s === 'all' ? db.offers.length : db.offers.filter((o) => o.status === s).length}</span></button>)}</div>
      <ul className="border border-line rounded-r2 divide-y divide-line">
        {list.map((o) => (
          <li key={o.id}><a href={`#/admin/doi-tac/${o.id}`} className="flex items-center gap-3 p-4 hover:bg-soft max-md:flex-wrap">
            <div className="flex-1 min-w-0"><p className="text-[13px] font-medium">{o.title} <span className="font-mono text-xs text-ink-3">{o.id}</span>{o.orderCode && <span className="text-xs text-accent"> · từ đơn {o.orderCode}</span>}</p><p className="text-xs text-ink-3">{findService(o.service)?.short} · hạn {day(o.dueAt)} · {OFFER_ST[o.status]}{o.provider && ` · ${providerName(db, o.provider)}`}{o.status === 'open' && ` · ${o.bids.length} ứng tuyển`}</p></div>
            <span className="font-mono text-xs w-24 text-right">{vnd(o.budget)}</span>
          </a></li>
        ))}
        {list.length === 0 && <li className="p-6 text-[13px] text-ink-3">Không có việc nào.</li>}
      </ul>
    </div>
  )
}

function OfferDetail({ id }: { id: string }) {
  const { db, assignOffer, offerMsg, acceptOffer, reviseOffer, cancelOffer } = useStore()
  const o = db.offers.find((x) => x.id === id)!
  const [msg, setMsg] = useState('')
  const [rating, setRating] = useState(5)
  const [review, setReview] = useState('')
  const [rev, setRev] = useState('')
  return (
    <Page max={980}>
      <PageHead back={() => navigate('/admin/doi-tac')} title={o.title} sub={<>{o.id} · {findService(o.service)?.name} · {vnd(o.budget)} · hạn {day(o.dueAt)} · {OFFER_ST[o.status]}{o.orderCode && <> · <a href={`#/admin/viec/${o.orderCode}`} className="text-accent">đơn {o.orderCode}</a></>}</>} end={['open', 'accepted'].includes(o.status) && <Btn kind="plain" onClick={() => cancelOffer(o.id)}>Hủy việc</Btn>} />
      <div className="grid grid-cols-[minmax(0,1fr)_320px] max-lg:grid-cols-1 gap-6 items-start">
        <div className="grid gap-5">
          <section className="border border-line rounded-r2 p-4 grid gap-1.5"><h2 className="text-sm">Brief gửi đối tác</h2><p className="text-[13px] text-ink-2">{o.brief}</p><p className="text-xs text-ink-3">Không chứa tên người liên hệ, SĐT, email của khách.</p></section>
          {o.status === 'open' && (
            <section className="grid gap-2"><h2 className="text-sm">Ứng tuyển ({o.bids.length})</h2>
              {o.bids.length === 0 ? <p className="text-[13px] text-ink-3">Chưa có đối tác ứng tuyển. Đối tác đúng kỹ năng đã được thông báo.</p> : (
                <ul className="border border-line rounded-r2 divide-y divide-line">{o.bids.map((b) => { const p = db.providers.find((x) => x.id === b.provider)!; const r = ratingOf(db.offers, p.id); return (
                  <li key={b.provider} className="p-3.5 flex gap-3 items-start max-md:flex-wrap"><div className="flex-1"><p className="text-[13px] font-medium">{p.name} <span className="text-xs text-ink-3 font-normal">{r ? `${r.toFixed(1)}/5` : 'chưa có đánh giá'} · {db.offers.filter((x) => x.provider === p.id && x.status === 'approved').length} việc xong · giao trong {b.days} ngày</span></p><p className="text-[13px] text-ink-2">{b.note}</p></div><Btn size="s" kind="primary" onClick={() => assignOffer(o.id, p.id)}>Chọn</Btn></li>
                ) })}</ul>
              )}
            </section>
          )}
          {o.delivery && (
            <section className={`border rounded-r2 p-4 grid gap-2 ${o.status === 'delivered' ? 'border-accent/40' : 'border-line'}`}>
              <h2 className="text-sm">Bài giao · {when(o.delivery.t)}</h2>
              <a href={o.delivery.link} target="_blank" rel="noreferrer" className="text-[13px] text-accent break-all">{o.delivery.link}</a>
              {o.delivery.note && <p className="text-[13px] text-ink-2">{o.delivery.note}</p>}
              {o.status === 'delivered' && (
                <div className="grid gap-2.5 border-t border-line pt-3">
                  <div className="flex items-center gap-1.5 text-[13px]">Chấm điểm:{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} điểm`} className={`size-8 rounded-r border font-mono text-xs ${n <= rating ? 'border-accent bg-accent text-white' : 'border-line'}`}>{n}</button>)}</div>
                  <input value={review} onChange={(e) => setReview(e.target.value)} placeholder="Nhận xét cho đối tác" className="h-9 px-2.5 border border-line rounded-r text-[13px] outline-none focus:border-accent" />
                  <div className="flex gap-2 flex-wrap"><Btn kind="primary" onClick={() => acceptOffer(o.id, rating, review.trim())}>Đạt QC{o.orderCode ? ' · đưa vào duyệt đơn' : ''}</Btn></div>
                  <div className="flex gap-2"><input value={rev} onChange={(e) => setRev(e.target.value)} placeholder="Cần sửa gì?" className="flex-1 h-9 px-2.5 border border-line rounded-r text-[13px] outline-none focus:border-accent" /><Btn disabled={!rev.trim()} onClick={() => { reviseOffer(o.id, rev.trim()); setRev('') }}>Yêu cầu sửa</Btn></div>
                </div>
              )}
              {o.rating && <p className="text-[13px]">Đánh giá {o.rating}/5{o.review && ` — ${o.review}`}</p>}
            </section>
          )}
        </div>
        <aside className="border border-line rounded-r2 grid grid-rows-[auto_1fr_auto] max-h-[520px]">
          <h2 className="text-sm p-3 border-b border-line">Trao đổi với {o.provider ? providerName(db, o.provider) : 'đối tác'}</h2>
          <div className="overflow-auto p-3 grid gap-2 content-start">{o.msgs.length === 0 ? <p className="text-xs text-ink-3">Chưa có tin nhắn.</p> : o.msgs.map((m, i) => <p key={i} className={`text-[13px] rounded-r2 px-3 py-2 max-w-[90%] ${m.from === 'studio' ? 'bg-ink text-white justify-self-end' : 'bg-soft'}`}>{m.text}<span className={`block text-[11px] ${m.from === 'studio' ? 'text-white/60' : 'text-ink-3'}`}>{when(m.t)}</span></p>)}</div>
          <form className="flex gap-2 p-2.5 border-t border-line" onSubmit={(e) => { e.preventDefault(); if (msg.trim()) { offerMsg(o.id, msg.trim(), 'studio'); setMsg('') } }}><input value={msg} onChange={(e) => setMsg(e.target.value)} disabled={!o.provider} placeholder={o.provider ? 'Nhắn đối tác…' : 'Chọn đối tác để nhắn'} className="flex-1 h-9 px-2.5 border border-line rounded-r text-[13px] outline-none focus:border-accent" /><Btn type="submit" disabled={!o.provider}>Gửi</Btn></form>
        </aside>
      </div>
    </Page>
  )
}

function ProviderList() {
  const { db, updateProvider } = useStore()
  const canManage = canStaff(db, 'partners.manage')
  return (
    <ul className="grid grid-cols-3 max-lg:grid-cols-1 gap-3">
      {db.providers.map((p) => {
        const [l, dot] = P_ST[p.status], r = ratingOf(db.offers, p.id), mine = db.offers.filter((o) => o.provider === p.id)
        return (
          <li key={p.id} className="border border-line rounded-r2 p-4 grid gap-2 content-start">
            <div className="flex items-center gap-2"><span className="size-8 rounded-r bg-ink text-white grid place-items-center font-mono text-xs">{p.name.split(' ').map((w) => w[0]).slice(-2).join('')}</span><div className="min-w-0"><h3 className="text-sm">{p.name}</h3><p className="text-xs text-ink-3">{p.contact} · {p.email}</p></div></div>
            <p className="text-xs inline-flex items-center gap-1.5"><span className={`size-1.5 rounded-full ${dot}`} />{l}</p>
            <p className="text-[13px] text-ink-2">{p.bio}</p>
            <p className="text-xs text-ink-3">{p.skills.map((s) => findService(s)?.short).join(', ')} · nhận {Math.round(p.share * 100)}% · {r ? `${r.toFixed(1)}/5` : 'chưa có đánh giá'} · {mine.filter((o) => o.status === 'approved').length} việc xong</p>
            <p className="text-xs text-ink-3">Mẫu: {p.portfolio.join(', ') || '—'}</p>
            {canManage && <div className="flex gap-2 flex-wrap">
              {p.status === 'pending' && <Btn size="s" kind="primary" onClick={() => updateProvider(p.id, { status: 'active' })}>Duyệt hồ sơ</Btn>}
              {p.status === 'active' && <Btn size="s" onClick={() => updateProvider(p.id, { status: 'suspended' })}>Tạm khóa</Btn>}
              {p.status === 'suspended' && <Btn size="s" onClick={() => updateProvider(p.id, { status: 'active' })}>Mở khóa</Btn>}
              <select value={p.share} onChange={(e) => updateProvider(p.id, { share: Number(e.target.value) })} className="h-8 px-1.5 border border-line rounded-r text-[13px]" aria-label="Tỷ lệ chia">{[0.6, 0.65, 0.7, 0.75, 0.8].map((x) => <option key={x} value={x}>{Math.round(x * 100)}%</option>)}</select>
            </div>}
          </li>
        )
      })}
    </ul>
  )
}

function Payouts() {
  const { db, payOut } = useStore()
  const list = db.offers.filter((o) => o.payout).sort((a, b) => (a.payout!.status === 'pending' ? -1 : 1) - (b.payout!.status === 'pending' ? -1 : 1))
  return (
    <ul className="border border-line rounded-r2 divide-y divide-line">
      {list.map((o) => { const p = db.providers.find((x) => x.id === o.provider)!; return (
        <li key={o.id} className="flex items-center gap-3 p-4 max-md:flex-wrap">
          <div className="flex-1 min-w-0"><p className="text-[13px] font-medium">{p.name} · {o.title}</p><p className="text-xs text-ink-3">{o.id} · {vnd(o.budget)} × {Math.round(p.share * 100)}% · {p.bank || 'chưa có tài khoản'}</p></div>
          <span className="font-mono text-[13px] w-28 text-right">{vnd(o.payout!.amount)}</span>
          {o.payout!.status === 'pending' ? <Btn size="s" kind="primary" disabled={!p.bank} onClick={() => payOut(o.id)}>Đánh dấu đã chi</Btn> : <span className="text-xs text-ok w-32 text-right">Đã chi {when(o.payout!.paidAt!)}</span>}
        </li>
      ) })}
      {list.length === 0 && <li className="p-6 text-[13px] text-ink-3">Chưa có khoản chi trả.</li>}
      <li className="p-3 text-xs text-ink-3">Bản thử nghiệm: chi trả ghi nhận thủ công, chưa nối ngân hàng.</li>
    </ul>
  )
}

function PostBtn() {
  const { postOffer } = useStore()
  const [open, setOpen] = useState(false)
  const [service, setService] = useState<ServiceCode>('post')
  const [title, setTitle] = useState('')
  const [brief, setBrief] = useState('')
  const [budget, setBudget] = useState(500_000)
  const [days, setDays] = useState(2)
  const pii = /\d{9,}|@/.test(brief)
  return (<>
    <Btn kind="primary" onClick={() => setOpen(true)}>Đăng việc</Btn>
    {open && <Modal title="Đăng việc lên marketplace" onClose={() => setOpen(false)}>
      <label className="grid gap-1.5 text-[13px]"><span className="text-ink-3">Dịch vụ</span><select value={service} onChange={(e) => setService(e.target.value as ServiceCode)} className="h-9 px-2 border border-line rounded-r">{CATALOG.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</select></label>
      <label className="grid gap-1.5 text-[13px]"><span className="text-ink-3">Tiêu đề</span><input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 px-2.5 border border-line rounded-r outline-none focus:border-accent" /></label>
      <label className="grid gap-1.5 text-[13px]"><span className="text-ink-3">Brief</span><textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={3} className="border border-line rounded-r p-2.5 outline-none focus:border-accent" />{pii && <span className="text-xs text-red-600">Brief có vẻ chứa SĐT hoặc email — hãy xóa thông tin cá nhân.</span>}</label>
      <div className="grid grid-cols-2 gap-3 text-[13px]">
        <label className="grid gap-1.5"><span className="text-ink-3">Ngân sách (đ)</span><input inputMode="numeric" value={budget.toLocaleString('vi-VN')} onChange={(e) => setBudget(Number(e.target.value.replace(/\D/g, '')) || 0)} className="h-9 px-2.5 border border-line rounded-r font-mono text-right" /></label>
        <label className="grid gap-1.5"><span className="text-ink-3">Hạn (ngày)</span><input type="number" min={1} value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value)))} className="h-9 px-2.5 border border-line rounded-r font-mono text-right" /></label>
      </div>
      <div className="flex gap-2 justify-end"><Btn onClick={() => setOpen(false)}>Hủy</Btn><Btn kind="primary" disabled={title.trim().length < 4 || budget < 100_000 || pii} onClick={() => { const id = postOffer({ service, title: title.trim(), brief: brief.trim(), budget, dueAt: Date.now() + days * 86_400_000 }); setOpen(false); navigate(`/admin/doi-tac/${id}`) }}>Đăng</Btn></div>
    </Modal>}
  </>)
}
