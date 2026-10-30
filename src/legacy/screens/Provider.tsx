import { useEffect, useRef, useState } from 'react'
import { CATALOG, findService, type ServiceCode } from '../lib/catalog'
import { navigate } from '../router'
import { useStore, type Offer, type Provider as P } from '../store'
import { Btn, Icon, Page, PageHead, day, left, vnd, when } from '../ui'
import { ratingOf } from './admin/Partners'

const ST: Record<Offer['status'], string> = { open: 'Đang nhận ứng tuyển', accepted: 'Đang làm', delivered: 'Đã giao, chờ studio QC', approved: 'Đạt QC', canceled: 'Đã hủy' }

/** Cổng đối tác marketplace (phase 3, prototype). */
export default function Provider({ tab, id }: { tab?: string; id?: string }) {
  const { db } = useStore()
  const me = db.providers.find((p) => p.id === db.session.provider)
  if (!me) return <Gate />
  const t = tab === 'viec' && id ? 'detail' : (['', 'cua-toi', 'thu-nhap', 'ho-so'].includes(tab ?? '') ? tab ?? '' : '')
  const nav = [['', 'Việc mới', 'grid'], ['cua-toi', 'Việc của tôi', 'box'], ['thu-nhap', 'Thu nhập', 'card'], ['ho-so', 'Hồ sơ', 'user']] as const
  return (
    <div className="min-h-dvh grid grid-cols-[220px_minmax(0,1fr)] max-md:grid-cols-1">
      <aside className="bg-side border-r border-line p-3 flex flex-col gap-0.5 sticky top-0 h-dvh max-md:hidden">
        <div className="flex items-center gap-2 px-2 pb-3 pt-1"><span className="size-6 rounded-r bg-ink text-white grid place-items-center"><Icon name="split" size={13} /></span><div><p className="text-sm font-medium leading-tight">AI Studio</p><p className="text-xs text-ink-3">Cổng đối tác</p></div></div>
        {nav.map(([k, l, ic]) => <a key={k} href={`#/doi-tac${k ? '/' + k : ''}`} className={`flex items-center gap-2.5 min-h-9 px-2 rounded-r text-[13px] ${t === k ? 'bg-hover font-medium' : 'text-ink-2 hover:bg-hover'}`}><Icon name={ic} />{l}</a>)}
        <div className="flex-1" />
        <Out me={me} />
      </aside>
      <div className="min-w-0">
        <header className="h-[53px] border-b border-line px-6 max-md:px-4 flex items-center gap-2">
          <nav className="md:hidden flex gap-1 overflow-x-auto no-scrollbar">{nav.map(([k, l]) => <a key={k} href={`#/doi-tac${k ? '/' + k : ''}`} className={`whitespace-nowrap text-[13px] px-2 min-h-9 inline-flex items-center rounded-r ${t === k ? 'bg-hover font-medium' : 'text-ink-3'}`}>{l}</a>)}</nav>
          <div className="ml-auto"><Bell /></div>
        </header>
        {me.status === 'pending' && <p className="mx-6 mt-4 text-[13px] bg-warn/10 rounded-r2 px-4 py-2.5">Hồ sơ đang chờ studio duyệt. Bạn xem được việc nhưng chưa ứng tuyển được.</p>}
        {me.status === 'suspended' && <p className="mx-6 mt-4 text-[13px] bg-red-50 text-red-700 rounded-r2 px-4 py-2.5">Tài khoản đang tạm khóa. Liên hệ studio để biết thêm.</p>}
        {t === 'detail' ? <Detail id={id!} me={me} /> : t === 'cua-toi' ? <Mine me={me} /> : t === 'thu-nhap' ? <Earnings me={me} /> : t === 'ho-so' ? <Profile me={me} /> : <Open me={me} />}
      </div>
    </div>
  )
}

function Out({ me }: { me: P }) {
  const { providerLogout } = useStore()
  return <div className="border-t border-line pt-3 px-2 grid gap-1"><p className="text-[13px] font-medium">{me.name}</p><p className="text-xs text-ink-3">{me.contact}</p><button type="button" onClick={() => { providerLogout(); navigate('/doi-tac') }} className="text-left text-[13px] text-ink-3 hover:text-ink min-h-8">Đăng xuất</button></div>
}

function Bell() {
  const { db, readProviderNotifs } = useStore()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const list = db.notifs.filter((n) => n.provider === db.session.provider).slice(0, 8)
  const unread = list.filter((n) => !n.read).length
  useEffect(() => { if (!open) return; const on = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }; addEventListener('mousedown', on); return () => removeEventListener('mousedown', on) }, [open])
  return (
    <div className="relative" ref={box}>
      <button type="button" onClick={() => { setOpen(!open); if (unread) readProviderNotifs() }} aria-label="Thông báo" className="relative size-9 grid place-items-center rounded-r hover:bg-soft"><Icon name="bell" />{unread > 0 && <span className="absolute top-2 right-2 size-1.5 rounded-full bg-accent" />}</button>
      {open && <div className="absolute right-0 top-11 w-80 bg-white border border-line rounded-r2 shadow-[0_12px_32px_-12px_rgb(0_0_0/.2)] z-50 p-1.5">{list.length === 0 ? <p className="p-3 text-[13px] text-ink-3">Chưa có thông báo.</p> : list.map((n) => <a key={n.id} href={n.href} onClick={() => setOpen(false)} className="block p-2 rounded-r hover:bg-soft text-[13px]">{n.text}<span className="block text-xs text-ink-3">{when(n.t)}</span></a>)}</div>}
    </div>
  )
}

function Gate() {
  const { db, providerLogin, providerSignup } = useStore()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [f, setF] = useState({ name: '', contact: '', email: '', bio: '', portfolio: '', skills: [] as ServiceCode[] })
  const ok = f.name.trim().length >= 3 && f.contact.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email) && f.skills.length > 0
  return (
    <div className="min-h-dvh grid place-items-center p-6">
      <div className="w-full max-w-md grid gap-4">
        <div><h1 className="text-xl">Cổng đối tác AI Studio</h1><p className="text-[13px] text-ink-3">Studio và freelancer nhận việc thiết kế, video, web từ khách SMB. Bản thử nghiệm.</p></div>
        <div className="flex gap-1 border-b border-line">{([['in', 'Đăng nhập'], ['up', 'Đăng ký đối tác']] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setMode(k)} className={`min-h-9 px-3 text-[13px] -mb-px border-b-2 ${mode === k ? 'border-ink font-medium' : 'border-transparent text-ink-3'}`}>{l}</button>)}</div>
        {mode === 'in' ? (
          <div className="grid gap-2">{db.providers.map((p) => <button key={p.id} type="button" onClick={() => { providerLogin(p.id); navigate('/doi-tac') }} className="text-left border border-line rounded-r2 p-3 hover:border-accent"><b className="text-[13px]">{p.name}</b><span className="block text-xs text-ink-3">{p.email} · {p.status === 'active' ? 'đang hoạt động' : p.status === 'pending' ? 'chờ duyệt' : 'tạm khóa'}</span></button>)}<p className="text-xs text-ink-3">Prototype: chọn tài khoản để đăng nhập. Bản thật dùng email + mã xác minh.</p></div>
        ) : (
          <form className="grid gap-3 text-[13px]" onSubmit={(e) => { e.preventDefault(); if (ok) { providerSignup({ name: f.name.trim(), contact: f.contact.trim(), email: f.email.trim(), skills: f.skills, bio: f.bio.trim(), portfolio: f.portfolio.split(',').map((x) => x.trim()).filter(Boolean) }); navigate('/doi-tac/ho-so') } }}>
            {([['name', 'Tên studio / freelancer'], ['contact', 'Người liên hệ'], ['email', 'Email']] as const).map(([k, l]) => <label key={k} className="grid gap-1.5"><span className="text-ink-3">{l}</span><input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="h-9 px-2.5 border border-line rounded-r outline-none focus:border-accent" /></label>)}
            <fieldset className="grid gap-1"><legend className="text-ink-3 mb-1">Nhận làm</legend><div className="flex flex-wrap gap-1.5">{CATALOG.map((c) => <label key={c.code} className={`border rounded px-2 py-1 cursor-pointer ${f.skills.includes(c.code) ? 'border-accent text-accent' : 'border-line text-ink-3'}`}><input type="checkbox" className="sr-only" checked={f.skills.includes(c.code)} onChange={() => setF({ ...f, skills: f.skills.includes(c.code) ? f.skills.filter((x) => x !== c.code) : [...f.skills, c.code] })} />{c.short}</label>)}</div></fieldset>
            <label className="grid gap-1.5"><span className="text-ink-3">Giới thiệu ngắn</span><textarea value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} rows={2} className="border border-line rounded-r p-2.5 outline-none focus:border-accent" /></label>
            <label className="grid gap-1.5"><span className="text-ink-3">Dự án mẫu (cách nhau dấu phẩy)</span><input value={f.portfolio} onChange={(e) => setF({ ...f, portfolio: e.target.value })} className="h-9 px-2.5 border border-line rounded-r outline-none focus:border-accent" /></label>
            <Btn kind="primary" type="submit" disabled={!ok}>Gửi hồ sơ</Btn>
            <p className="text-xs text-ink-3">Studio duyệt hồ sơ trong 1–2 ngày làm việc. Brief bạn nhận không chứa thông tin cá nhân của khách.</p>
          </form>
        )}
        <a href="#/" className="text-[13px] text-ink-3">Về trang chủ</a>
      </div>
    </div>
  )
}

function Card({ o, me }: { o: Offer; me: P }) {
  const applied = o.bids.some((b) => b.provider === me.id)
  return (
    <li><a href={`#/doi-tac/viec/${o.id}`} className="block border border-line rounded-r2 p-4 hover:border-ink/30 grid gap-1.5">
      <div className="flex items-baseline gap-2 flex-wrap"><b className="text-sm">{o.title}</b><span className="font-mono text-xs text-ink-3">{o.id}</span><span className="ml-auto font-mono text-[13px]">Bạn nhận {vnd(Math.round(o.budget * me.share))}</span></div>
      <p className="text-xs text-ink-3">{findService(o.service)?.name} · hạn {day(o.dueAt)}{o.dueAt > Date.now() ? ` (còn ${left(o.dueAt - Date.now())})` : ''} · {applied && o.status === 'open' ? 'Đã ứng tuyển' : ST[o.status]}</p>
      <p className="text-[13px] text-ink-2 line-clamp-2">{o.brief}</p>
    </a></li>
  )
}

function Open({ me }: { me: P }) {
  const { db } = useStore()
  const [all, setAll] = useState(false)
  const list = db.offers.filter((o) => o.status === 'open' && (all || me.skills.includes(o.service)))
  return (
    <Page max={960}>
      <PageHead title={`Chào ${me.contact}`} sub={`Bạn nhận ${Math.round(me.share * 100)}% giá việc sau khi studio QC đạt.`} />
      <dl className="grid grid-cols-3 border border-line rounded-r2 divide-x divide-line [&>div]:p-4">
        <div><dt className="text-xs text-ink-3">Việc phù hợp</dt><dd className="text-xl font-mono">{db.offers.filter((o) => o.status === 'open' && me.skills.includes(o.service)).length}</dd></div>
        <div><dt className="text-xs text-ink-3">Đang làm</dt><dd className="text-xl font-mono">{db.offers.filter((o) => o.provider === me.id && ['accepted', 'delivered'].includes(o.status)).length}</dd></div>
        <div><dt className="text-xs text-ink-3">Đánh giá</dt><dd className="text-xl font-mono">{ratingOf(db.offers, me.id) ? ratingOf(db.offers, me.id).toFixed(1) + '/5' : '—'}</dd></div>
      </dl>
      <label className="flex items-center gap-2 text-[13px] text-ink-2"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="accent-accent" />Hiện cả việc ngoài kỹ năng của tôi</label>
      {list.length === 0 ? <p className="text-[13px] text-ink-3 border border-line rounded-r2 p-6">Chưa có việc mới phù hợp. Bạn sẽ nhận thông báo khi studio đăng việc.</p> : <ul className="grid gap-3">{list.map((o) => <Card key={o.id} o={o} me={me} />)}</ul>}
    </Page>
  )
}

function Mine({ me }: { me: P }) {
  const { db } = useStore()
  const groups: [string, Offer[]][] = [
    ['Đã ứng tuyển', db.offers.filter((o) => o.status === 'open' && o.bids.some((b) => b.provider === me.id))],
    ['Đang làm', db.offers.filter((o) => o.provider === me.id && o.status === 'accepted')],
    ['Chờ studio QC', db.offers.filter((o) => o.provider === me.id && o.status === 'delivered')],
    ['Hoàn tất', db.offers.filter((o) => o.provider === me.id && o.status === 'approved')],
  ]
  return (
    <Page max={960}>
      <PageHead title="Việc của tôi" />
      {groups.map(([g, l]) => <section key={g} className="grid gap-2"><h2 className="text-sm">{g} <span className="font-mono text-xs text-ink-3">{l.length}</span></h2>{l.length ? <ul className="grid gap-3">{l.map((o) => <Card key={o.id} o={o} me={me} />)}</ul> : <p className="text-[13px] text-ink-3">Không có.</p>}</section>)}
    </Page>
  )
}

function Detail({ id, me }: { id: string; me: P }) {
  const { db, providerApply, offerMsg, providerDeliver } = useStore()
  const o = db.offers.find((x) => x.id === id)
  const [note, setNote] = useState('')
  const [days, setDays] = useState(2)
  const [msg, setMsg] = useState('')
  const [link, setLink] = useState('')
  const [dn, setDn] = useState('')
  if (!o) return <Page><PageHead title="Không tìm thấy việc" back={() => navigate('/doi-tac')} /></Page>
  const mine = o.provider === me.id
  const bid = o.bids.find((b) => b.provider === me.id)
  const lastRev = [...o.msgs].reverse().find((m) => m.text.startsWith('Yêu cầu sửa'))
  return (
    <Page max={960}>
      <PageHead back={() => navigate('/doi-tac')} title={o.title} sub={`${o.id} · ${findService(o.service)?.name} · hạn ${day(o.dueAt)} · ${ST[o.status]}`} />
      <div className="grid grid-cols-[minmax(0,1fr)_300px] max-lg:grid-cols-1 gap-6 items-start">
        <div className="grid gap-4">
          <section className="border border-line rounded-r2 p-4 grid gap-2"><h2 className="text-sm">Brief</h2><p className="text-[13px] text-ink-2">{o.brief}</p><p className="font-mono text-[13px]">Ngân sách {vnd(o.budget)} · bạn nhận {vnd(Math.round(o.budget * me.share))}</p></section>
          {o.status === 'open' && (bid ? <p className="text-[13px] bg-soft rounded-r2 px-4 py-3">Bạn đã ứng tuyển {when(bid.t)}: “{bid.note}” · {bid.days} ngày. Studio sẽ báo khi chọn.</p> : me.status !== 'active' ? <p className="text-[13px] text-ink-3">Hồ sơ cần được duyệt để ứng tuyển.</p> : !me.skills.includes(o.service) ? <p className="text-[13px] text-ink-3">Việc này ngoài kỹ năng đã khai báo trong hồ sơ.</p> : (
            <form className="border border-line rounded-r2 p-4 grid gap-2.5 text-[13px]" onSubmit={(e) => { e.preventDefault(); if (note.trim().length >= 10) providerApply(o.id, note.trim(), days) }}>
              <h2 className="text-sm">Ứng tuyển</h2>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Vì sao bạn phù hợp, cách làm dự kiến (tối thiểu 10 ký tự)" className="border border-line rounded-r p-2.5 outline-none focus:border-accent" />
              <label className="flex items-center gap-2">Giao trong <input type="number" min={1} value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value)))} className="h-8 w-16 px-2 border border-line rounded-r font-mono" /> ngày</label>
              <div><Btn kind="primary" type="submit" disabled={note.trim().length < 10}>Gửi ứng tuyển</Btn></div>
            </form>
          ))}
          {mine && o.status === 'accepted' && (
            <form className="border border-accent/40 rounded-r2 p-4 grid gap-2.5 text-[13px]" onSubmit={(e) => { e.preventDefault(); if (/^https:\/\/\S+/.test(link)) providerDeliver(o.id, link, dn.trim()) }}>
              <h2 className="text-sm">Giao bài{o.revisions > 0 && ` (lần sửa ${o.revisions})`}</h2>
              {lastRev && <p className="bg-warn/10 rounded-r px-3 py-2">{lastRev.text}</p>}
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link tệp (https://…)" className="h-9 px-2.5 border border-line rounded-r outline-none focus:border-accent" />
              <input value={dn} onChange={(e) => setDn(e.target.value)} placeholder="Ghi chú cho studio" className="h-9 px-2.5 border border-line rounded-r outline-none focus:border-accent" />
              <div><Btn kind="primary" type="submit" disabled={!/^https:\/\/\S+/.test(link)}>Giao bài</Btn></div>
            </form>
          )}
          {mine && o.delivery && o.status !== 'accepted' && <section className="border border-line rounded-r2 p-4 text-[13px] grid gap-1"><h2 className="text-sm">Bài đã giao · {when(o.delivery.t)}</h2><p className="break-all text-accent">{o.delivery.link}</p>{o.rating && <p>Studio đánh giá {o.rating}/5{o.review && ` — ${o.review}`}</p>}{o.payout && <p className="font-mono">{o.payout.status === 'paid' ? `Đã nhận ${vnd(o.payout.amount)}` : `Chờ chi trả ${vnd(o.payout.amount)}`}</p>}</section>}
          {!mine && o.provider && <p className="text-[13px] text-ink-3">Việc này đã giao cho đối tác khác.</p>}
        </div>
        {mine && (
          <aside className="border border-line rounded-r2 grid grid-rows-[auto_1fr_auto] max-h-[480px]">
            <h2 className="text-sm p-3 border-b border-line">Hỏi studio</h2>
            <div className="overflow-auto p-3 grid gap-2 content-start">{o.msgs.length === 0 ? <p className="text-xs text-ink-3">Chưa có tin nhắn.</p> : o.msgs.map((m, i) => <p key={i} className={`text-[13px] rounded-r2 px-3 py-2 max-w-[90%] ${m.from === 'provider' ? 'bg-ink text-white justify-self-end' : 'bg-soft'}`}>{m.text}</p>)}</div>
            <form className="flex gap-2 p-2.5 border-t border-line" onSubmit={(e) => { e.preventDefault(); if (msg.trim()) { offerMsg(o.id, msg.trim(), 'provider'); setMsg('') } }}><input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Nhắn studio…" className="flex-1 h-9 px-2.5 border border-line rounded-r text-[13px] outline-none focus:border-accent" /><Btn type="submit">Gửi</Btn></form>
          </aside>
        )}
      </div>
    </Page>
  )
}

function Earnings({ me }: { me: P }) {
  const { db } = useStore()
  const list = db.offers.filter((o) => o.provider === me.id && o.payout)
  const paid = list.filter((o) => o.payout!.status === 'paid').reduce((s, o) => s + o.payout!.amount, 0)
  const due = list.filter((o) => o.payout!.status === 'pending').reduce((s, o) => s + o.payout!.amount, 0)
  return (
    <Page max={960}>
      <PageHead title="Thu nhập" sub={`Chi trả về ${me.bank || 'chưa khai báo tài khoản'} · đối soát hằng tuần`} />
      <dl className="grid grid-cols-2 border border-line rounded-r2 divide-x divide-line [&>div]:p-4"><div><dt className="text-xs text-ink-3">Đã nhận</dt><dd className="text-xl font-mono">{vnd(paid)}</dd></div><div><dt className="text-xs text-ink-3">Chờ chi trả</dt><dd className="text-xl font-mono">{vnd(due)}</dd></div></dl>
      <ul className="border border-line rounded-r2 divide-y divide-line">{list.map((o) => <li key={o.id} className="flex items-center gap-3 p-3.5 text-[13px]"><span className="flex-1">{o.title} <span className="font-mono text-xs text-ink-3">{o.id}</span></span><span className="font-mono">{vnd(o.payout!.amount)}</span><span className={`text-xs w-28 text-right ${o.payout!.status === 'paid' ? 'text-ok' : 'text-warn'}`}>{o.payout!.status === 'paid' ? `Đã chi ${day(o.payout!.paidAt!)}` : 'Chờ chi trả'}</span></li>)}{list.length === 0 && <li className="p-6 text-[13px] text-ink-3">Chưa có khoản nào.</li>}</ul>
    </Page>
  )
}

function Profile({ me }: { me: P }) {
  const { updateProvider } = useStore()
  const [f, setF] = useState({ bio: me.bio, bank: me.bank, portfolio: me.portfolio.join(', '), skills: me.skills })
  const [saved, setSaved] = useState(false)
  return (
    <Page max={720}>
      <PageHead title="Hồ sơ đối tác" sub={`${me.name} · ${me.email} · ${me.status === 'active' ? 'đã xác minh' : me.status === 'pending' ? 'chờ duyệt' : 'tạm khóa'}`} />
      <form className="grid gap-3 text-[13px]" onSubmit={(e) => { e.preventDefault(); updateProvider(me.id, { bio: f.bio, bank: f.bank, skills: f.skills, portfolio: f.portfolio.split(',').map((x) => x.trim()).filter(Boolean) }); setSaved(true) }}>
        <label className="grid gap-1.5"><span className="text-ink-3">Giới thiệu</span><textarea value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} rows={3} className="border border-line rounded-r p-2.5 outline-none focus:border-accent" /></label>
        <fieldset className="grid gap-1"><legend className="text-ink-3 mb-1">Nhận làm</legend><div className="flex flex-wrap gap-1.5">{CATALOG.map((c) => <label key={c.code} className={`border rounded px-2 py-1 cursor-pointer ${f.skills.includes(c.code) ? 'border-accent text-accent' : 'border-line text-ink-3'}`}><input type="checkbox" className="sr-only" checked={f.skills.includes(c.code)} onChange={() => setF({ ...f, skills: f.skills.includes(c.code) ? f.skills.filter((x) => x !== c.code) : [...f.skills, c.code] })} />{c.short}</label>)}</div></fieldset>
        <label className="grid gap-1.5"><span className="text-ink-3">Dự án mẫu</span><input value={f.portfolio} onChange={(e) => setF({ ...f, portfolio: e.target.value })} className="h-9 px-2.5 border border-line rounded-r outline-none focus:border-accent" /></label>
        <label className="grid gap-1.5"><span className="text-ink-3">Tài khoản nhận tiền (chỉ hiện 4 số cuối)</span><input value={f.bank} onChange={(e) => setF({ ...f, bank: e.target.value })} placeholder="Ngân hàng + số tài khoản" className="h-9 px-2.5 border border-line rounded-r outline-none focus:border-accent" /></label>
        <div className="flex items-center gap-3"><Btn kind="primary" type="submit" disabled={!f.skills.length}>Lưu hồ sơ</Btn>{saved && <span className="text-xs text-ok">Đã lưu</span>}</div>
        <p className="text-xs text-ink-3">Tỷ lệ chia {Math.round(me.share * 100)}% do studio đặt theo thỏa thuận.</p>
      </form>
    </Page>
  )
}
