import { useEffect, useRef, useState } from 'react'
import { CHANNELS, KKIND, PASS_RATE, TEST_QUESTIONS, canGoLive, type ChannelId, type KItem, type KKind, type Lead } from '../../lib/agents'
import { navigate } from '../../router'
import { useMine, useStore } from '../../store'
import { AIBadge, Btn, Empty, Icon, Modal, Page, PageHead, Tabs, vnd, when } from '../../ui'

type Tab = 'tong-quan' | 'kien-thuc' | 'thu' | 'lead' | 'nhan-vien' | 'kenh' | 'dieu-khoan'
const STATUS = { setup: 'Đang thiết lập', testing: 'Đang thử', live: 'Đang chạy', paused: 'Tạm dừng' }
const HEAT: Record<Lead['heat'], [string, string]> = { hot: ['Nóng', 'bg-red-500'], warm: ['Ấm', 'bg-warn'], cold: ['Nguội', 'bg-idle'] }
const LEAD_ST: Record<Lead['status'], string> = { new: 'Mới', sent: 'Đã liên hệ', won: 'Chốt được', lost: 'Không thành' }

/** Agent bán hàng thuê dài hạn: khách tự nạp và duyệt kiến thức, thử, kết nối kênh, nhận lead. */
export default function SalesAgent({ tab = 'tong-quan' }: { tab?: string }) {
  const me = useMine()
  const { startSales } = useStore()
  const a = me.sales
  if (!a) return (
    <Page>
      <PageHead title="Agent bán hàng" sub="Một trợ lý trả lời người mua 24/7 trên website, Zalo, Messenger… theo đúng thông tin của shop bạn. Có chuyên viên studio hỗ trợ khi cần." />
      <div className="border border-line rounded-r2 p-6 grid gap-4 max-w-2xl">
        <ol className="grid gap-3 text-[13px]">
          {[['Nạp thông tin', 'Giới thiệu, sản phẩm, giá, câu hỏi thường gặp. Agent research thêm từ nguồn công khai để bạn duyệt.'], ['Thi thử', `Agent trả lời bộ câu hỏi người mua hay hỏi. Đạt ${PASS_RATE * 100}% mới được chạy thật.`], ['Kết nối kênh', 'Website, Zalo OA, Messenger, Instagram, Telegram hoặc API.'], ['Nhận lead', 'Khách muốn gọi điện → agent xin số và chuyển cho nhân viên của bạn kèm tóm tắt cuộc trò chuyện.']].map(([t, d], i) => (
            <li key={t} className="flex gap-3"><span className="size-6 shrink-0 rounded-full border border-line grid place-items-center font-mono text-xs">{i + 1}</span><span><b className="block">{t}</b><span className="text-ink-2">{d}</span></span></li>
          ))}
        </ol>
        <p className="text-xs text-ink-3">Phí theo thỏa thuận riêng với studio; bạn xem và chấp nhận điều khoản trước khi chạy thật.</p>
        <div><Btn kind="primary" onClick={startSales}>Bắt đầu thiết lập</Btn></div>
      </div>
    </Page>
  )
  const t = (['tong-quan', 'kien-thuc', 'thu', 'lead', 'nhan-vien', 'kenh', 'dieu-khoan'].includes(tab) ? tab : 'tong-quan') as Tab
  const proposed = a.knowledge.filter((k) => k.status === 'proposed').length
  const fresh = a.leads.filter((l) => l.status === 'new').length
  return (
    <Page>
      <PageHead title={<span className="inline-flex items-center gap-2">{a.name} <AIBadge /></span>} sub={<span className="inline-flex items-center gap-1.5"><span className={`size-1.5 rounded-full ${a.status === 'live' ? 'bg-ok live' : a.status === 'paused' ? 'bg-idle' : 'bg-warn'}`} />{STATUS[a.status]} · {a.conv.toLocaleString('vi-VN')} hội thoại</span>} />
      <Tabs value={t} onChange={(v) => navigate(`/app/agent/${v}`)} items={[
        { id: 'tong-quan', label: 'Tổng quan' },
        { id: 'kien-thuc', label: <>Kiến thức{proposed > 0 && <span className="ml-1.5 font-mono text-[11px] bg-accent text-white rounded px-1">{proposed}</span>}</> },
        { id: 'thu', label: 'Phòng thử' },
        { id: 'lead', label: <>Lead{fresh > 0 && <span className="ml-1.5 font-mono text-[11px] bg-accent text-white rounded px-1">{fresh}</span>}</> },
        { id: 'nhan-vien', label: 'Nhân viên' },
        { id: 'kenh', label: 'Kênh' },
        { id: 'dieu-khoan', label: 'Điều khoản & hỗ trợ' },
      ]} />
      {t === 'tong-quan' ? <Overview /> : t === 'kien-thuc' ? <Knowledge /> : t === 'thu' ? <TestRoom /> : t === 'lead' ? <Leads /> : t === 'nhan-vien' ? <Team /> : t === 'kenh' ? <Channels /> : <Terms />}
    </Page>
  )
}

function Overview() {
  const a = useMine().sales!
  const { setSalesStatus } = useStore()
  const pass = !!a.test && a.test.score / a.test.total >= PASS_RATE
  const steps: [string, boolean, string][] = [
    ['Kiến thức đã duyệt', a.knowledge.filter((k) => k.status === 'approved').length >= 5, 'kien-thuc'],
    [`Thi thử đạt ${PASS_RATE * 100}%`, pass, 'thu'],
    ['Kết nối ít nhất 1 kênh', a.channels.some((c) => c.connected), 'kenh'],
    ['Chấp nhận điều khoản', !!a.terms?.acceptedAt, 'dieu-khoan'],
  ]
  const won = a.leads.filter((l) => l.status === 'won').length
  return (
    <div className="grid gap-5">
      <dl className="grid grid-cols-4 max-md:grid-cols-2 border border-line rounded-r2 divide-x divide-line max-md:divide-x-0 [&>div]:p-4">
        <div><dt className="text-xs text-ink-3">Hội thoại</dt><dd className="text-xl font-mono">{a.conv.toLocaleString('vi-VN')}</dd></div>
        <div><dt className="text-xs text-ink-3">Lead</dt><dd className="text-xl font-mono">{a.leads.length}</dd></div>
        <div><dt className="text-xs text-ink-3">Chốt được</dt><dd className="text-xl font-mono">{won}</dd></div>
        <div><dt className="text-xs text-ink-3">Thi thử</dt><dd className="text-xl font-mono">{a.test ? `${a.test.score}/${a.test.total}` : '—'}</dd></div>
      </dl>
      {a.status !== 'live' ? (
        <section className="border border-line rounded-r2 p-5 grid gap-3">
          <h2 className="text-sm">Trước khi chạy thật</h2>
          <ul className="grid gap-1">{steps.map(([l, ok, href]) => <li key={l}><a href={`#/app/agent/${href}`} className="flex items-center gap-2.5 min-h-9 text-[13px] hover:text-accent"><span className={`size-5 rounded-full grid place-items-center ${ok ? 'bg-ok text-white' : 'border border-line'}`}>{ok && <Icon name="check" size={12} />}</span>{l}<Icon name="arrow" size={13} className="ml-auto text-ink-3" /></a></li>)}</ul>
          <div><Btn kind="primary" disabled={!canGoLive(a)} onClick={() => setSalesStatus('live')}>{a.status === 'paused' ? 'Chạy lại' : 'Bật chạy thật'}</Btn></div>
        </section>
      ) : (
        <section className="border border-line rounded-r2 p-5 flex items-center gap-3 flex-wrap">
          <p className="text-[13px] flex-1 min-w-60">Agent đang trả lời trên {a.channels.filter((c) => c.connected).map((c) => CHANNELS[c.id].name).join(', ')}. Câu chưa trả lời được sẽ hiện ở tab Kiến thức để bạn bổ sung.</p>
          <Btn onClick={() => setSalesStatus('paused')}>Tạm dừng</Btn>
        </section>
      )}
      <section className="grid gap-2">
        <h2 className="text-sm">Lead gần đây</h2>
        {a.leads.length ? <ul className="border border-line rounded-r2 divide-y divide-line">{a.leads.slice(0, 4).map((l) => <LeadRow key={l.id} l={l} />)}</ul> : <p className="text-[13px] text-ink-3">Chưa có lead.</p>}
      </section>
    </div>
  )
}

function Knowledge() {
  const a = useMine().sales!
  const { editKnowledge, removeKnowledge, runResearch, addKnowledge } = useStore()
  const [filter, setFilter] = useState<'all' | 'proposed'>(a.knowledge.some((k) => k.status === 'proposed') ? 'proposed' : 'all')
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const list = a.knowledge.filter((k) => (filter === 'proposed' ? k.status === 'proposed' : k.status !== 'rejected'))
  return (
    <div className="grid gap-3">
      <div className="flex gap-2 flex-wrap items-center">
        <Tabs value={filter} onChange={setFilter} items={[{ id: 'proposed', label: `Chờ bạn duyệt (${a.knowledge.filter((k) => k.status === 'proposed').length})` }, { id: 'all', label: 'Tất cả' }]} />
        <span className="ml-auto flex gap-2">
          <Btn size="s" disabled={busy} onClick={() => { setBusy(true); setTimeout(() => { runResearch(); setBusy(false); setFilter('proposed') }, 1400) }}>{busy ? 'Đang research…' : 'Agent research thêm'}</Btn>
          <Btn size="s" kind="primary" onClick={() => setAdding(true)}>+ Thêm</Btn>
        </span>
      </div>
      <p className="text-xs text-ink-3">Agent chỉ dùng thông tin bạn đã duyệt. Thông tin research luôn kèm nguồn; câu người mua hỏi mà agent chưa biết cũng hiện ở đây.</p>
      {list.length === 0 ? <div className="border border-line rounded-r2"><Empty text={filter === 'proposed' ? 'Không có đề xuất nào chờ duyệt.' : 'Chưa có kiến thức.'} /></div> : (
        <ul className="grid gap-2">{list.map((k) => <KCard key={k.id} k={k} onSave={(p) => editKnowledge(k.id, p)} onRemove={() => removeKnowledge(k.id)} />)}</ul>
      )}
      {adding && <AddK onClose={() => setAdding(false)} onAdd={(x) => { addKnowledge(x); setAdding(false); setFilter('all') }} />}
    </div>
  )
}

function KCard({ k, onSave, onRemove }: { k: KItem; onSave: (p: Partial<KItem>) => void; onRemove: () => void }) {
  const { discussKnowledge } = useStore()
  const [edit, setEdit] = useState(false)
  const [body, setBody] = useState(k.body)
  const [talk, setTalk] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => setBody(k.body), [k.body])
  const src = k.source === 'research' ? 'Agent research' : k.source === 'learned' ? 'Người mua hỏi' : k.source === 'studio' ? 'Chuyên viên studio soạn' : 'Bạn nhập'
  return (
    <li className={`border rounded-r2 p-4 grid gap-2 ${k.status === 'proposed' ? 'border-accent/40' : 'border-line'}`}>
      <div className="flex items-center gap-2 flex-wrap text-xs text-ink-3"><span className="border border-line rounded px-1.5">{KKIND[k.kind]}</span>{src}{k.sourceUrl && <span>· nguồn: {k.sourceUrl}</span>}{k.status === 'proposed' && <span className="text-accent font-medium">Đề xuất</span>}</div>
      <h3 className="text-sm">{k.title}</h3>
      {edit ? <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="border border-line rounded-r p-2.5 text-[13px] outline-none focus:border-accent" />
        : <p className="text-[13px] text-ink-2">{k.body || <span className="text-ink-3">Chưa có câu trả lời — bạn bổ sung giúp agent.</span>}</p>}
      {talk && (
        <div className="grid gap-2 bg-soft rounded-r p-3">
          {k.comments.map((c, i) => <p key={i} className={`text-[13px] ${c.from === 'ai' ? 'text-ink-2' : ''}`}><b className="text-xs">{c.from === 'ai' ? 'Agent' : 'Bạn'}:</b> {c.text}</p>)}
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (msg.trim()) { discussKnowledge(k.id, msg.trim()); setMsg('') } }}>
            <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder='Ví dụ: sửa thành "Mở cửa 6:30–22:00"' className="flex-1 h-9 px-2.5 border border-line rounded-r text-[13px] bg-white outline-none focus:border-accent" />
            <Btn size="s" type="submit">Gửi</Btn>
          </form>
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        {edit ? <><Btn size="s" kind="primary" disabled={!body.trim()} onClick={() => { onSave({ body: body.trim(), status: 'approved' }); setEdit(false) }}>Lưu & duyệt</Btn><Btn size="s" kind="plain" onClick={() => setEdit(false)}>Hủy</Btn></> : <>
          {k.status === 'proposed' && <Btn size="s" kind="primary" disabled={!k.body} onClick={() => onSave({ status: 'approved' })}>Duyệt</Btn>}
          <Btn size="s" onClick={() => setEdit(true)}>Sửa</Btn>
          <Btn size="s" onClick={() => setTalk(!talk)}>Trao đổi{k.comments.length > 0 && ` (${k.comments.length})`}</Btn>
          {k.status === 'proposed' ? <Btn size="s" kind="plain" onClick={() => onSave({ status: 'rejected' })}>Bỏ qua</Btn> : <Btn size="s" kind="plain" onClick={onRemove}>Xóa</Btn>}
        </>}
      </div>
    </li>
  )
}

function AddK({ onClose, onAdd }: { onClose: () => void; onAdd: (x: { kind: KKind; title: string; body: string }) => void }) {
  const [kind, setKind] = useState<KKind>('product')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  return (
    <Modal title="Thêm kiến thức" onClose={onClose}>
      <label className="grid gap-1.5 text-[13px]"><span className="text-ink-3">Loại</span><select value={kind} onChange={(e) => setKind(e.target.value as KKind)} className="h-9 px-2 border border-line rounded-r">{(Object.keys(KKIND) as KKind[]).map((x) => <option key={x} value={x}>{KKIND[x]}</option>)}</select></label>
      <label className="grid gap-1.5 text-[13px]"><span className="text-ink-3">Tiêu đề</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: Trà đào cam sả" className="h-9 px-2.5 border border-line rounded-r outline-none focus:border-accent" /></label>
      <label className="grid gap-1.5 text-[13px]"><span className="text-ink-3">Agent sẽ trả lời</span><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Dạ trà đào cam sả 45.000đ ạ…" className="border border-line rounded-r p-2.5 outline-none focus:border-accent" /></label>
      <div className="flex gap-2 justify-end"><Btn onClick={onClose}>Hủy</Btn><Btn kind="primary" disabled={!title.trim() || !body.trim()} onClick={() => onAdd({ kind, title: title.trim(), body: body.trim() })}>Thêm</Btn></div>
    </Modal>
  )
}

function TestRoom() {
  const a = useMine().sales!
  const { salesChat, runSalesTest } = useStore()
  const [log, setLog] = useState<{ from: 'buyer' | 'agent'; text: string; tag?: string }[]>([{ from: 'agent', text: `Dạ em chào mình, em là trợ lý của ${a.name.replace('Trợ lý bán hàng ', '')}. Mình cần em tư vấn gì ạ?` }])
  const [msg, setMsg] = useState('')
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => end.current?.scrollIntoView({ block: 'nearest' }), [log])
  const send = (text: string) => {
    const hist = log.filter((l) => l.from === 'buyer').map((l) => l.text).concat(text)
    const r = salesChat(text, hist)
    setLog((l) => [...l, { from: 'buyer', text }, { from: 'agent', text: r.text, tag: r.lead ? 'Đã tạo lead (người mua đã đồng ý lưu số)' : r.askConsent ? 'Đang xin đồng ý trước khi lưu số' : r.unknown ? 'Đã ghi vào Kiến thức để bạn bổ sung' : undefined }])
  }
  const pass = a.test && a.test.score / a.test.total >= PASS_RATE
  return (
    <div className="grid grid-cols-[1fr_300px] max-lg:grid-cols-1 gap-4 items-start">
      <section className="border border-line rounded-r2 grid grid-rows-[1fr_auto] h-[520px]">
        <div className="overflow-auto p-4 grid gap-2.5 content-start">
          {log.map((l, i) => (
            <div key={i} className={`max-w-[85%] ${l.from === 'buyer' ? 'justify-self-end' : ''}`}>
              <p className={`text-[13px] rounded-r2 px-3 py-2 ${l.from === 'buyer' ? 'bg-ink text-white' : 'bg-soft'}`}>{l.text}</p>
              {l.tag && <p className="text-xs text-accent mt-1">{l.tag}</p>}
            </div>
          ))}
          <div ref={end} />
        </div>
        <form className="border-t border-line p-2.5 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (msg.trim()) { send(msg.trim()); setMsg('') } }}>
          <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Đóng vai người mua…" className="flex-1 h-9 px-2.5 border border-line rounded-r text-[13px] outline-none focus:border-accent" />
          <Btn kind="primary" type="submit">Gửi</Btn>
        </form>
      </section>
      <aside className="grid gap-3">
        <div className="border border-line rounded-r2 p-4 grid gap-2">
          <h2 className="text-sm">Thi thử</h2>
          <p className="text-xs text-ink-3">{TEST_QUESTIONS.length} câu người mua hay hỏi. Cần đạt {PASS_RATE * 100}% để chạy thật.</p>
          {a.test && <p className="text-[13px]"><span className="font-mono text-lg">{a.test.score}/{a.test.total}</span> <span className={pass ? 'text-ok' : 'text-warn'}>{pass ? 'Đạt' : 'Chưa đạt'}</span> <span className="text-xs text-ink-3">· {when(a.test.at)}</span></p>}
          <Btn onClick={runSalesTest}>{a.test ? 'Thi lại' : 'Chạy thi thử'}</Btn>
          {a.test && !pass && <a href="#/app/agent/kien-thuc" className="text-[13px] text-accent font-medium">Bổ sung kiến thức</a>}
        </div>
        <div className="border border-line rounded-r2 p-4 grid gap-1.5">
          <h2 className="text-sm">Thử nhanh</h2>
          {['Quán mở cửa mấy giờ?', 'Có giảm giá không?', 'Mình muốn đặt 30 ly, gọi tư vấn được không?', '0901234567', 'Đồng ý'].map((q) => <button key={q} type="button" onClick={() => send(q)} className="text-left text-[13px] min-h-8 px-2 rounded-r hover:bg-soft">{q}</button>)}
        </div>
        <p className="text-xs text-ink-3">Gọi điện bằng AI chưa có ở giai đoạn này: khi người mua muốn gọi, agent xin số (chỉ để liên hệ tư vấn) và chuyển lead cho {a.handoffTo || 'nhân viên của bạn'}.</p>
      </aside>
    </div>
  )
}

function LeadRow({ l, onOpen }: { l: Lead; onOpen?: () => void }) {
  const [h, dot] = HEAT[l.heat]
  const assignee = useMine().sales?.team?.find((m) => m.id === l.assignee)?.name
  return (
    <li><button type="button" onClick={onOpen ?? (() => navigate('/app/agent/lead'))} className="w-full text-left flex items-center gap-3 p-3 hover:bg-soft min-h-14">
      <span className={`size-2 rounded-full shrink-0 ${dot}`} title={h} />
      <span className="min-w-0 flex-1"><b className="text-[13px] block">{l.name} · <span className="font-mono font-normal">{l.phone}</span></b><span className="text-xs text-ink-3 block truncate">{l.need}</span></span>
      <span className="text-xs text-ink-3 text-right whitespace-nowrap">{LEAD_ST[l.status]}{assignee && ` · ${assignee}`}<span className="block">{CHANNELS[l.channel].name} · {when(l.t)}</span></span>
    </button></li>
  )
}

function Leads() {
  const a = useMine().sales!
  const { updateLead } = useStore()
  const [open, setOpen] = useState<string | null>(null)
  const l = a.leads.find((x) => x.id === open)
  return (
    <div className="grid gap-3">
      <p className="text-xs text-ink-3">Lead được gửi cho {a.handoffTo || 'nhân viên của bạn'} kèm tóm tắt. Số điện thoại chỉ dùng để liên hệ tư vấn theo đồng ý của người mua.</p>
      {a.leads.length ? <ul className="border border-line rounded-r2 divide-y divide-line">{a.leads.map((x) => <LeadRow key={x.id} l={x} onOpen={() => setOpen(x.id)} />)}</ul> : <div className="border border-line rounded-r2"><Empty text="Chưa có lead. Thử trong Phòng thử: hỏi đặt số lượng rồi để lại số điện thoại." /></div>}
      {l && (
        <Modal title={`${l.name} · ${l.phone}`} onClose={() => setOpen(null)}>
          <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-[13px] [&>dt]:text-ink-3">
            <dt>Nhu cầu</dt><dd>{l.need}</dd><dt>Sản phẩm</dt><dd>{l.product}</dd><dt>Ngân sách</dt><dd>{l.budget}</dd>
            <dt>Mức độ</dt><dd>{HEAT[l.heat][0]}</dd><dt>Tóm tắt</dt><dd>{l.summary}</dd><dt>Bước tiếp</dt><dd>{l.next}</dd><dt>Kênh</dt><dd>{CHANNELS[l.channel].name} · {when(l.t)}</dd><dt>Giao cho</dt><dd><select value={l.assignee ?? ''} onChange={(e) => updateLead(l.id, { assignee: e.target.value || undefined })} className="h-8 px-1.5 border border-line rounded-r"><option value="">Chưa giao</option>{(a.team ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></dd><dt>Đồng ý lưu số</dt><dd>{l.consentAt ? `Có · ${when(l.consentAt)}` : 'Chưa ghi nhận'}</dd>
          </dl>
          <label className="grid gap-1.5 text-[13px]"><span className="text-ink-3">Ghi chú</span><textarea defaultValue={l.note} onBlur={(e) => updateLead(l.id, { note: e.target.value })} rows={2} className="border border-line rounded-r p-2.5 outline-none focus:border-accent" /></label>
          <div className="flex gap-2 flex-wrap">{(Object.keys(LEAD_ST) as Lead['status'][]).map((s) => <Btn key={s} size="s" kind={l.status === s ? 'primary' : 'ghost'} onClick={() => updateLead(l.id, { status: s })}>{LEAD_ST[s]}</Btn>)}<a href={`tel:${l.phone}`} className="ml-auto inline-flex items-center h-8 px-3 rounded-r border border-line text-[13px] font-medium">Gọi {l.phone}</a></div>
        </Modal>
      )}
    </div>
  )
}

function Channels() {
  const a = useMine().sales!
  const { connectChannel, disconnectChannel } = useStore()
  const [c, setC] = useState<ChannelId | null>(null)
  const [v, setV] = useState('')
  return (
    <div className="grid gap-3">
      <p className="text-xs text-ink-3">Bản thử nghiệm: kết nối được mô phỏng, chưa gọi API của Zalo/Meta/Telegram.</p>
      <ul className="grid grid-cols-2 max-md:grid-cols-1 gap-3">
        {a.channels.map((ch) => (
          <li key={ch.id} className="border border-line rounded-r2 p-4 grid gap-2 content-start">
            <div className="flex items-center gap-2"><h3 className="text-sm">{CHANNELS[ch.id].name}</h3>{ch.connected && <span className="ml-auto inline-flex items-center gap-1.5 text-xs"><span className="size-1.5 rounded-full bg-ok" />Đã kết nối</span>}</div>
            <p className="text-xs text-ink-3">{ch.connected ? `${ch.detail} · ${ch.conv} hội thoại` : CHANNELS[ch.id].how}</p>
            {ch.id === 'web' && <a href={`#/w/${a.customer}`} target="_blank" rel="noreferrer" className="text-[13px] text-accent font-medium">Xem trước widget như người mua thấy</a>}
            {ch.id === 'web' && ch.connected && <code className="font-mono text-[11px] bg-soft rounded px-2 py-1.5 break-all">{`<script src="https://cdn.aistudio.vn/w.js" data-shop="${a.customer}"></script>`}</code>}
            <div>{ch.connected ? <Btn size="s" kind="plain" onClick={() => disconnectChannel(ch.id)}>Ngắt kết nối</Btn> : <Btn size="s" onClick={() => { setC(ch.id); setV('') }}>Kết nối</Btn>}</div>
          </li>
        ))}
      </ul>
      {c && (
        <Modal title={`Kết nối ${CHANNELS[c].name}`} onClose={() => setC(null)}>
          <label className="grid gap-1.5 text-[13px]"><span className="text-ink-3">{CHANNELS[c].field}</span><input value={v} onChange={(e) => setV(e.target.value)} className="h-9 px-2.5 border border-line rounded-r outline-none focus:border-accent" /></label>
          <div className="flex gap-2 justify-end"><Btn onClick={() => setC(null)}>Hủy</Btn><Btn kind="primary" disabled={v.trim().length < 3} onClick={() => { connectChannel(c, v.trim()); setC(null) }}>Kết nối</Btn></div>
        </Modal>
      )}
    </div>
  )
}

function Terms() {
  const a = useMine().sales!
  const { acceptTerms, updateSales, requestHelp } = useStore()
  const [agree, setAgree] = useState(false)
  const [help, setHelp] = useState('')
  const tm = a.terms
  const over = tm ? Math.max(0, a.conv - tm.includedConv) : 0
  const leadsN = a.leads.length
  const bill = tm ? tm.monthly + over * tm.extraPerConv + leadsN * tm.leadFee : 0
  return (
    <div className="grid gap-4 max-w-2xl">
      {!tm ? <div className="border border-line rounded-r2 p-5 text-[13px] text-ink-2">Studio đang chuẩn bị điều khoản riêng cho bạn (phí tháng, số hội thoại, phí vượt). Bạn sẽ nhận thông báo khi có.</div> : (
        <section className="border border-line rounded-r2 p-5 grid gap-3">
          <h2 className="text-sm">Điều khoản dịch vụ agent</h2>
          <dl className="grid grid-cols-2 gap-3 text-[13px] [&_dt]:text-xs [&_dt]:text-ink-3">
            <div><dt>Phí tháng</dt><dd className="font-mono">{vnd(tm.monthly)}</dd></div>
            <div><dt>Hội thoại kèm theo</dt><dd className="font-mono">{tm.includedConv.toLocaleString('vi-VN')}/tháng</dd></div>
            <div><dt>Hội thoại vượt</dt><dd className="font-mono">{vnd(tm.extraPerConv)} / hội thoại</dd></div>
            <div><dt>Phí mỗi lead</dt><dd className="font-mono">{tm.leadFee ? vnd(tm.leadFee) : 'Không tính'}</dd></div>
          </dl>
          {tm.note && <p className="text-[13px] text-ink-2">{tm.note}</p>}
          {tm.acceptedAt ? <p className="text-[13px] text-ok inline-flex items-center gap-1.5"><Icon name="check" size={14} />Đã chấp nhận {when(tm.acceptedAt)}</p> : <>
            <label className="flex gap-2 items-start text-[13px]"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="accent-accent mt-1" />Tôi đồng ý mức phí trên. Agent chỉ trả lời theo kiến thức tôi đã duyệt và không tự đặt giá ngoài giới hạn.</label>
            <div><Btn kind="primary" disabled={!agree} onClick={acceptTerms}>Chấp nhận điều khoản</Btn></div>
          </>}
        </section>
      )}
      {tm?.acceptedAt && (
        <section className="border border-line rounded-r2 p-5 grid gap-3 text-[13px]">
          <h2 className="text-sm">Mức dùng tháng này</h2>
          <div className="grid gap-1"><div className="flex text-xs text-ink-3"><span>Hội thoại</span><span className="ml-auto font-mono">{a.conv.toLocaleString('vi-VN')} / {tm.includedConv.toLocaleString('vi-VN')}</span></div><div className="h-1.5 bg-hover rounded-sm overflow-hidden"><i className={`block h-full ${a.conv > tm.includedConv ? 'bg-warn' : 'bg-accent'}`} style={{ width: `${Math.min(100, (a.conv / tm.includedConv) * 100)}%` }} /></div></div>
          <dl className="grid gap-1.5 [&>div]:flex [&_dd]:ml-auto [&_dd]:font-mono">
            <div><dt>Phí tháng</dt><dd>{vnd(tm.monthly)}</dd></div>
            {over > 0 && <div><dt>{over.toLocaleString('vi-VN')} hội thoại vượt × {vnd(tm.extraPerConv)}</dt><dd>{vnd(over * tm.extraPerConv)}</dd></div>}
            {tm.leadFee > 0 && <div><dt>{leadsN} lead × {vnd(tm.leadFee)}</dt><dd>{vnd(leadsN * tm.leadFee)}</dd></div>}
            <div className="border-t border-line pt-1.5 font-medium"><dt>Tạm tính</dt><dd>{vnd(bill)}</dd></div>
          </dl>
          <p className="text-xs text-ink-3">Chốt hóa đơn cuối tháng; thanh toán bằng credit hoặc chuyển khoản (bản thử nghiệm).</p>
        </section>
      )}
      <section className="border border-line rounded-r2 p-5 grid gap-3 text-[13px]">
        <h2 className="text-sm">Nhờ chuyên viên hỗ trợ</h2>
        <p className="text-ink-3 text-xs">Agent tự làm phần lớn việc; khi cần, chuyên viên studio soạn kiến thức hoặc chỉnh kịch bản giúp bạn. Nội dung chuyên viên soạn vẫn chờ bạn duyệt.</p>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (help.trim().length > 5) { requestHelp(help.trim()); setHelp('') } }}>
          <input value={help} onChange={(e) => setHelp(e.target.value)} placeholder="Ví dụ: soạn giúp kịch bản trả lời khách hỏi đặt tiệc" className="flex-1 h-9 px-2.5 border border-line rounded-r outline-none focus:border-accent" />
          <Btn type="submit" disabled={help.trim().length <= 5}>Gửi</Btn>
        </form>
        {(a.help ?? []).map((h) => (
          <div key={h.id} className="border-t border-line pt-2.5 grid gap-1">
            <p><span className="text-xs text-ink-3">{when(h.t)} · </span>{h.text}</p>
            {h.status === 'done' ? <p className="text-ink-2 bg-soft rounded-r px-2.5 py-1.5"><b className="text-xs">{h.by}:</b> {h.reply}</p> : <p className="text-xs text-warn">Đang chờ chuyên viên</p>}
          </div>
        ))}
      </section>
      <section className="border border-line rounded-r2 p-5 grid gap-3 text-[13px]">
        <h2 className="text-sm">Cách agent làm việc</h2>
        <label className="grid gap-1.5"><span className="text-ink-3">Chuyển lead cho</span><input defaultValue={a.handoffTo} onBlur={(e) => updateSales({ handoffTo: e.target.value })} className="h-9 px-2.5 border border-line rounded-r outline-none focus:border-accent" /></label>
        <label className="grid gap-1.5"><span className="text-ink-3">Giọng điệu</span><input defaultValue={a.tone} onBlur={(e) => updateSales({ tone: e.target.value })} className="h-9 px-2.5 border border-line rounded-r outline-none focus:border-accent" /></label>
        <label className="grid gap-1.5"><span className="text-ink-3">Giảm giá tối đa agent được hứa</span><select value={a.maxDiscountPct} onChange={(e) => updateSales({ maxDiscountPct: Number(e.target.value) })} className="h-9 px-2 border border-line rounded-r w-40">{[0, 5, 10, 15, 20].map((x) => <option key={x} value={x}>{x ? `${x}%` : 'Không giảm'}</option>)}</select></label>
      </section>
    </div>
  )
}

function Team() {
  const a = useMine().sales!
  const { saveTeam } = useStore()
  const [list, setList] = useState(a.team ?? [])
  const [saved, setSaved] = useState(false)
  const ok = list.every((m) => m.name.trim() && /^0\d[\d\s]{8,11}$/.test(m.phone.trim())) && list.some((m) => m.active)
  const set = (i: number, p: Partial<(typeof list)[number]>) => { setList(list.map((m, j) => (j === i ? { ...m, ...p } : m))); setSaved(false) }
  return (
    <div className="grid gap-3 max-w-2xl">
      <p className="text-xs text-ink-3">Lead được chia lần lượt cho người đang bật, ai ít lead mới hơn nhận trước. Mỗi người mở <a href="#/nv" className="text-accent">cổng nhân viên</a> trên điện thoại để gọi lại người mua.</p>
      <ul className="border border-line rounded-r2 divide-y divide-line">
        {list.map((m, i) => (
          <li key={m.id} className="flex items-center gap-2 p-3 max-sm:flex-wrap">
            <input value={m.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Tên" className="flex-1 h-9 px-2.5 border border-line rounded-r text-[13px] outline-none focus:border-accent" />
            <input value={m.phone} onChange={(e) => set(i, { phone: e.target.value })} placeholder="SĐT" className="w-40 h-9 px-2.5 border border-line rounded-r text-[13px] font-mono outline-none focus:border-accent" />
            <span className="text-xs text-ink-3 w-16 text-center">{a.leads.filter((l) => l.assignee === m.id && l.status === 'new').length} mới</span>
            <label className="flex items-center gap-1.5 text-[13px]"><input type="checkbox" checked={m.active} onChange={(e) => set(i, { active: e.target.checked })} className="accent-accent" />Nhận lead</label>
            <button type="button" aria-label="Xóa" onClick={() => { setList(list.filter((_, j) => j !== i)); setSaved(false) }} className="size-9 rounded-r text-ink-3 hover:bg-soft">×</button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2 items-center"><Btn onClick={() => { setList([...list, { id: 'nv' + Date.now().toString(36), name: '', phone: '', active: true }]); setSaved(false) }}>+ Thêm nhân viên</Btn><Btn kind="primary" disabled={!ok} onClick={() => { saveTeam(list.map((m) => ({ ...m, name: m.name.trim(), phone: m.phone.trim() }))); setSaved(true) }}>Lưu</Btn>{saved && <span className="text-xs text-ok">Đã lưu</span>}{!ok && <span className="text-xs text-ink-3">Cần tên, SĐT hợp lệ và ít nhất 1 người nhận lead.</span>}</div>
    </div>
  )
}
