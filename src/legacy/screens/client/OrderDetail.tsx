import { useState, useTransition } from 'react'
import { approveManagedDraft } from '@/app/(frontend)/actions/payment'
import { findService, personas, QC_CHECKS } from '../../lib/catalog'
import { navigate } from '../../router'
import { orderLabel, revisionsLeft, stepIndex, STEPS, useStore, useMine, type Order } from '../../store'
import { Artwork } from '../../components/Artwork'
import { ReviewThreads } from '../../components/ReviewThreads'
import { AIBadge, Avatar, Bar, Btn, Empty, Icon, Modal, Page, PageHead, StatusDot, Tabs, day, vnd, when } from '../../ui'

type Tab = 'tien-do' | 'ban-nhap' | 'thanh-toan' | 'tep'

export default function OrderDetail({ code, tab = 'tien-do' }: { code: string; tab?: string }) {
  const db = useMine()
  const { cancelOrder } = useStore()
  const o = db.orders.find((x) => x.code === code)
  const [cancel, setCancel] = useState(false)
  if (!o) return <Page><PageHead title="Không tìm thấy đơn" back={() => navigate('/app/don-hang')} /></Page>
  const svc = findService(o.service)!
  const s = orderLabel(o)
  const t = (['tien-do', 'ban-nhap', 'thanh-toan', 'tep'].includes(tab) ? tab : 'tien-do') as Tab
  const pending = db.payments.find((p) => p.orderCode === o.code && p.status === 'pending')
  const go = (x: Tab) => navigate(`/app/don-hang/${o.code}${x === 'tien-do' ? '' : '/' + x}`)

  return (
    <Page>
      <PageHead back={() => navigate('/app/don-hang')} title={`${svc.name} · ${o.brand}`}
        sub={<span className="inline-flex items-center gap-3 flex-wrap"><span className="font-mono">{o.code}</span><StatusDot status={s.tone}>{s.label}</StatusDot><span>hạn giao {day(o.dueAt)}</span></span>}
        end={<>
          {o.job === 'client_review' && t !== 'ban-nhap' && <Btn kind="primary" onClick={() => go('ban-nhap')}>Xem bản nháp v{o.version} <Icon name="arrow" size={14} /></Btn>}
          {pending && <Btn kind="primary" onClick={() => navigate(`/app/thanh-toan/${pending.id}`)}>Thanh toán {vnd(pending.amount)}</Btn>}
          {o.status === 'completed' && t !== 'tep' && <Btn kind="primary" onClick={() => go('tep')}>Tải tệp gốc</Btn>}
        </>}
      />

      <Banner o={o} onPay={() => navigate(pending ? `/app/thanh-toan/${pending.id}` : `/app/don-hang/${o.code}/thanh-toan`)} onCancel={() => setCancel(true)} />

      <div className="grid gap-6">
        <Tabs<Tab> value={t} onChange={go} items={[
          { id: 'tien-do', label: 'Tiến độ' },
          { id: 'ban-nhap', label: <>Bản nháp {o.version > 0 && <span className="text-ink-3 font-normal">v{o.version}</span>}</> },
          { id: 'thanh-toan', label: 'Thanh toán' },
          { id: 'tep', label: 'Tệp' },
        ]} />
        {t === 'tien-do' && <Progress o={o} />}
        {t === 'ban-nhap' && <Review o={o} />}
        {t === 'thanh-toan' && <Payments o={o} />}
        {t === 'tep' && <Files o={o} />}
      </div>

      {cancel && (
        <Modal title="Hủy đơn này?" onClose={() => setCancel(false)}>
          <p className="text-[13px] text-ink-2">Đơn chưa thanh toán cọc nên chị không mất phí. Báo giá {o.quoteCode} sẽ không dùng được nữa.</p>
          <div className="flex gap-2 justify-end"><Btn onClick={() => setCancel(false)}>Giữ đơn</Btn><Btn kind="primary" onClick={() => { cancelOrder(o.code, 'Khách hủy trước khi thanh toán cọc', 'client'); setCancel(false) }}>Hủy đơn</Btn></div>
        </Modal>
      )}
    </Page>
  )
}

function Banner({ o, onPay, onCancel }: { o: Order; onPay: () => void; onCancel: () => void }) {
  const base = 'flex items-center gap-3 px-4 py-3 rounded-r2 text-[13px] max-sm:flex-wrap'
  if (o.status === 'awaiting_deposit') return <div className={`${base} bg-warn/10 text-ink`}><Icon name="card" className="text-warn" /><p className="flex-1">Đơn sẽ bắt đầu ngay khi studio nhận cọc <b>{vnd(o.price.depositAmount)}</b>.</p><Btn size="s" onClick={onCancel}>Hủy đơn</Btn><Btn size="s" kind="primary" onClick={onPay}>Thanh toán cọc</Btn></div>
  if (o.status === 'awaiting_final') return <div className={`${base} bg-warn/10`}><Icon name="card" className="text-warn" /><p className="flex-1">Chị đã duyệt bản v{o.version}. Thanh toán phần còn lại <b>{vnd(o.price.total - o.paid)}</b> để mở tệp gốc.</p><Btn size="s" kind="primary" onClick={onPay}>Thanh toán</Btn></div>
  if (o.job === 'input_required' && o.input) return <AskBox o={o} />
  if (o.job === 'on_hold') return <div className={`${base} bg-soft`}><Icon name="clock" /><p className="flex-1">Studio tạm dừng đơn này. Chuyên viên sẽ liên hệ với chị.</p></div>
  if (o.status === 'canceled') return <div className={`${base} bg-soft text-ink-2`}><Icon name="x" /><p className="flex-1">Đơn đã hủy — {o.cancelReason}</p></div>
  return null
}

function AskBox({ o }: { o: Order }) {
  const { answerInput } = useStore()
  const [a, setA] = useState('')
  return (
    <div className="grid gap-2.5 px-4 py-3 rounded-r2 bg-accent/5 border border-accent/30 text-[13px]">
      <p className="flex gap-2"><Icon name="chat" className="text-accent flex-none mt-0.5" /><span><b>Agent cần thêm thông tin</b> · {when(o.input!.t)}<span className="block text-ink-2">{o.input!.q}</span></span></p>
      <form className="flex gap-2 max-sm:flex-col" onSubmit={(e) => { e.preventDefault(); if (a.trim()) answerInput(o.code, a.trim()) }}>
        <input value={a} onChange={(e) => setA(e.target.value)} placeholder="Trả lời để agent làm tiếp…" className="flex-1 h-10 px-3 border border-line rounded-r bg-white outline-none focus:border-accent" />
        <Btn kind="primary" type="submit" disabled={!a.trim()}>Gửi trả lời</Btn>
      </form>
    </div>
  )
}

function Progress({ o }: { o: Order }) {
  const svc = findService(o.service)!
  const cur = stepIndex(o)
  const events = o.events.filter((e) => !e.internal).slice().reverse()
  const queued = o.status === 'active' && ['queued', 'offered', 'assigned'].includes(o.job)
  const working = o.status === 'active' && ['running', 'submitted', 'qc_review', 'revision_requested'].includes(o.job)
  return (
    <div className="grid gap-8">
      <ol className="grid grid-cols-7 max-md:flex max-md:overflow-x-auto no-scrollbar" aria-label="Các bước">
        {STEPS.map((s, i) => {
          const done = i < cur || o.job === 'completed', now = i === cur && o.job !== 'completed' && o.status !== 'canceled'
          return (
            <li key={s} className="relative min-w-0 max-md:min-w-[104px] pr-2" aria-current={now ? 'step' : undefined}>
              <div className="flex items-center mb-2">
                <span className={`size-[18px] rounded-full grid place-items-center flex-none border transition-colors ${done ? 'bg-accent border-accent text-white' : now ? 'border-accent bg-white live' : 'border-line bg-white'}`}>
                  {done ? <Icon name="check" size={11} /> : now ? <span className="size-1.5 rounded-full bg-accent" /> : null}
                </span>
                {i < STEPS.length - 1 && <span className={`h-px flex-1 ${done ? 'bg-accent' : 'bg-line'}`} />}
              </div>
              <p className={`text-[13px] leading-snug ${now ? 'text-ink font-medium' : done ? 'text-ink-2' : 'text-ink-3'}`}>{s}</p>
              {now && i === 5 && <p className="text-xs text-accent mt-0.5">Đang chờ bạn</p>}
            </li>
          )
        })}
      </ol>

      {o.plan && (
        <section className="border border-line rounded-r2 p-4 grid gap-2.5">
          <div className="flex items-baseline gap-2"><h2 className="text-sm">Kế hoạch thực hiện</h2><span className="text-xs text-ink-3 ml-auto">{o.plan.status === 'pending' ? 'Chuyên viên đang duyệt — sẽ bắt đầu ngay sau khi duyệt' : `Chuyên viên đã duyệt ${when(o.plan.approvedAt ?? o.plan.createdAt)}`}</span></div>
          <ol className="grid gap-1.5">
            {o.plan.steps.map((s, i) => {
              const doneN = o.plan!.status === 'approved' ? (['completed', 'accepted', 'client_review', 'pending_approval', 'qc_review', 'submitted'].includes(o.job) ? o.plan!.steps.length : Math.floor((o.progress / 100) * o.plan!.steps.length)) : 0
              const st = i < doneN ? 'done' : i === doneN && o.plan!.status === 'approved' && o.job === 'running' ? 'now' : 'todo'
              return <li key={s.id} className="flex items-center gap-2.5 text-[13px]"><span className={`size-[18px] rounded-full grid place-items-center flex-none border ${st === 'done' ? 'bg-accent border-accent text-white' : st === 'now' ? 'border-accent live' : 'border-line'}`}>{st === 'done' ? <Icon name="check" size={11} /> : <span className="font-mono text-[10px] text-ink-3">{i + 1}</span>}</span><span className={st === 'todo' ? 'text-ink-3' : ''}>{s.title}</span></li>
            })}
          </ol>
          {o.plan.note && <p className="text-xs text-ink-3">Ghi chú chuyên viên: {o.plan.note}</p>}
        </section>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-10 max-lg:grid-cols-1 max-lg:gap-7">
        <section>
          <div className="flex items-baseline gap-2 mb-3">
            <h2 className="text-sm">Diễn biến</h2>
            {o.status === 'active' && o.job !== 'completed' && <span className="inline-flex items-center gap-1.5 text-xs text-ink-3 ml-auto"><span className="size-1.5 rounded-full bg-ok" /> Cập nhật trực tiếp</span>}
          </div>
          <ol>
            {working && (
              <li className="grid grid-cols-[28px_1fr] gap-3 pb-5 enter">
                <Avatar id={o.job === 'qc_review' || o.job === 'submitted' ? 'lan' : svc.agent} size={28} />
                <div className="pt-1"><p className="text-sm text-ink-2 inline-flex items-center gap-2">{o.job === 'qc_review' || o.job === 'submitted' ? 'Lan đang kiểm tra chất lượng' : `${personas[svc.agent].name} đang làm`}<span className="typing inline-flex gap-1"><i /><i /><i /></span></p></div>
              </li>
            )}
            {queued && (
              <li className="grid grid-cols-[28px_1fr] gap-3 pb-5">
                <span className="size-7 rounded-full border border-dashed border-idle grid place-items-center text-ink-3"><Icon name="clock" size={14} /></span>
                <div className="pt-1"><p className="text-sm font-medium">Đang xếp hàng</p><p className="text-[13px] text-ink-3">{personas[svc.agent].name} sẽ nhận việc trong ít phút.</p></div>
              </li>
            )}
            {events.map((e, i) => {
              const p = e.actor in personas ? personas[e.actor as keyof typeof personas] : null
              return (
                <li key={e.id} className="enter grid grid-cols-[28px_1fr] gap-3 relative pb-5 last:pb-0">
                  {i < events.length - 1 && <span className="absolute left-[13.5px] top-8 bottom-1 w-px bg-line" />}
                  {p ? <Avatar id={e.actor} size={28} /> : <span className="size-7 rounded-full bg-soft grid place-items-center text-ink-2"><Icon name={e.actor === 'owner' ? 'shield' : e.actor === 'client' ? 'user' : 'card'} size={14} /></span>}
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[13px] text-ink-3 flex items-center gap-1.5 flex-wrap">
                      {p ? <><b className="text-ink">{p.name}</b> · {p.role} <AIBadge /></> : <b className="text-ink">{{ owner: 'Chuyên viên', client: 'Bạn', system: 'Hệ thống' }[e.actor as 'owner']}</b>}
                      <time className="font-mono text-xs ml-auto">{when(e.t)}</time>
                    </p>
                    <p className="text-sm text-ink-2 mt-0.5">{e.text}</p>
                    {e.version && o.version > 0 && (
                      <a href={`#/app/don-hang/${o.code}/ban-nhap`} className="mt-2.5 inline-flex items-center gap-3 border border-line rounded-r2 p-2 pr-4 hover:bg-side">
                        <span className="w-20 h-14 rounded-r overflow-hidden bg-[#f4efe8] grid place-items-center"><Artwork service={o.service} brand={o.brand} v={e.version} small /></span>
                        <span><span className="block text-[13px] font-medium">Bản nháp v{e.version}</span><span className="block text-xs text-ink-3">{svc.deliverables.length} tệp · có watermark</span></span>
                      </a>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </section>

        <aside className="grid gap-6 content-start">
          <section className="border border-line rounded-r2 p-4 grid gap-3">
            <p className="text-xs text-ink-3">Tiến độ</p>
            <Bar pct={o.status === 'completed' ? 100 : Math.round((cur / 6) * 100)} />
            <dl className="text-[13px]">
              {[['Hạn giao', day(o.dueAt)], ['Lượt sửa còn', `${revisionsLeft(o)} / ${o.includedRevisions + o.extraRevisions}`], ['Đã thanh toán', `${vnd(o.paid)} / ${vnd(o.price.total)}`]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 py-2 border-t border-line"><dt className="text-ink-3">{k}</dt><dd className="tabular-nums text-right">{v}</dd></div>
              ))}
            </dl>
          </section>
          <section>
            <h2 className="text-sm mb-2">Đội thực hiện</h2>
            <ul className="grid gap-2.5">
              {[svc.agent, 'lan' as const].map((id) => <li key={id} className="flex items-center gap-2.5"><Avatar id={id} size={28} /><span className="text-[13px]"><b>{personas[id].name}</b> <span className="text-ink-3">· {personas[id].role}</span></span><AIBadge /></li>)}
              <li className="flex items-center gap-2.5"><span className="size-7 rounded-full bg-soft grid place-items-center text-xs font-medium text-ink-2">LC</span><span className="text-[13px]"><b>Longca</b> <span className="text-ink-3">· Chuyên viên duyệt</span></span></li>
            </ul>
          </section>
          <section>
            <h2 className="text-sm mb-2">Brief</h2>
            <p className="text-[13px] text-ink-2">{o.style}</p>
          </section>
        </aside>
      </div>
    </div>
  )
}

export function Viewer({ o, ver, setVer, file, setFile }: { o: Order; ver: number; setVer: (v: number) => void; file: number; setFile: (f: number) => void }) {
  const [compare, setCompare] = useState(false)
  const svc = findService(o.service)!
  const reviewPins = o.revisions.filter((r) => r.version === ver).flatMap((r) => r.annots).filter((a) => (a.asset ?? 0) === file && (a.viewport ?? 'desktop') === 'desktop')
  return (
    <section className="min-w-0 grid gap-3 content-start">
      <div className="flex items-center gap-2 flex-wrap">
        <div role="group" aria-label="Phiên bản" className="flex p-0.5 gap-0.5 border border-line rounded-r">
          {Array.from({ length: o.version }, (_, i) => i + 1).map((v) => (
            <button key={v} type="button" aria-pressed={ver === v && !compare} onClick={() => { setVer(v); setCompare(false) }} className={`h-7 max-md:h-10 px-3 rounded text-xs ${ver === v && !compare ? 'bg-hover font-medium text-ink' : 'text-ink-2'}`}>v{v}{v === o.version && o.version > 1 && ' · mới'}</button>
          ))}
        </div>
        {o.version > 1 && <Btn size="s" kind={compare ? 'ghost' : 'plain'} aria-pressed={compare} onClick={() => setCompare((c) => !c)}><Icon name="split" size={14} /> So sánh v{o.version - 1} / v{o.version}</Btn>}
        <span className="ml-auto text-xs text-ink-3 inline-flex items-center gap-1.5"><Icon name="shield" size={13} /> {o.status === 'completed' ? 'Bản gốc' : 'Bản xem trước có watermark'}</span>
      </div>
      <div className="relative border border-line rounded-r2 bg-[#f4efe8] aspect-[3/2] max-md:aspect-[4/3] grid place-items-center overflow-hidden">
        {compare ? (
          <div className="grid grid-cols-2 w-full h-full divide-x divide-[#e2d9cd]">
            {[o.version - 1, o.version].map((v) => <div key={v} className="relative grid place-items-center p-6"><span className="absolute top-3 left-3 font-mono text-xs text-[#8a7564]">v{v}</span><Artwork service={o.service} brand={o.brand} v={v} variant={file} /></div>)}
          </div>
        ) : (
          <div className="enter w-full h-full grid place-items-center p-10" key={`${ver}-${file}`}><Artwork service={o.service} brand={o.brand} v={ver} variant={file} /></div>
        )}
        {!compare && reviewPins.map((a, i) => a.kind === 'region' && a.region ? (
          <span key={a.id} title={a.text} style={{ left: `${a.region.x}%`, top: `${a.region.y}%`, width: `${a.region.width}%`, height: `${a.region.height}%` }} className="absolute border-2 border-accent bg-accent/10 rounded-r pointer-events-none"><i className="absolute -top-3 -left-3 size-6 rounded-full bg-accent text-white text-xs not-italic grid place-items-center shadow">{i + 1}</i></span>
        ) : (
          <span key={a.id} title={a.text} style={{ left: `${a.x}%`, top: `${a.y}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 size-6 rounded-full bg-accent text-white text-xs grid place-items-center shadow border-2 border-white pointer-events-none">{i + 1}</span>
        ))}
        {o.status !== 'completed' && <span aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center text-[#3f2e22]/[0.06] text-5xl max-md:text-2xl font-medium -rotate-12 select-none tracking-widest">AI STUDIO · PREVIEW</span>}
      </div>
      <ul className="flex gap-2 overflow-x-auto no-scrollbar" aria-label="Tệp trong bản nháp">
        {svc.deliverables.map((f, i) => (
          <li key={f}><button type="button" aria-pressed={file === i} onClick={() => { setFile(i); setCompare(false) }} className={`flex items-center gap-2.5 border rounded-r2 p-1.5 pr-3 text-left transition-colors ${file === i ? 'border-accent' : 'border-line hover:bg-side'}`}>
            <span className="w-14 h-10 rounded bg-[#f4efe8] grid place-items-center overflow-hidden"><Artwork service={o.service} brand={o.brand} v={ver} variant={i} small /></span>
            <span className="text-[13px] whitespace-nowrap">{f}</span>
          </button></li>
        ))}
      </ul>
    </section>
  )
}

function Review({ o }: { o: Order }) {
  const { syncApp } = useStore()
  const [ver, setVer] = useState(o.version)
  const [file, setFile] = useState(0)
  const [confirm, setConfirm] = useState(false)
  const [saving, startSaving] = useTransition()
  const [error, setError] = useState('')
  const svc = findService(o.service)!
  if (o.version === 0) return <Empty text={`Bản nháp sẽ hiện ở đây. ${personas[svc.agent].name} đang ${o.status === 'awaiting_deposit' ? 'chờ cọc để bắt đầu' : 'thực hiện'} — chị sẽ nhận thông báo khi có bản đầu tiên.`} />
  const canAct = o.job === 'client_review'
  const total = o.includedRevisions + o.extraRevisions
  const rest = o.price.total - o.paid
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-8 max-lg:grid-cols-1">
      <Viewer o={o} ver={Math.min(ver, o.version)} setVer={setVer} file={file} setFile={setFile} />
      <aside className="grid gap-5 content-start">
        <section className="border border-line rounded-r2 p-4 grid gap-3">
          <div className="flex items-baseline justify-between"><p className="text-xs text-ink-3">Lượt sửa</p><p className="font-mono text-xs">còn {revisionsLeft(o)} / {total}</p></div>
          <div className="flex gap-1">{Array.from({ length: total }, (_, i) => <span key={i} className={`h-1 flex-1 rounded-sm ${i < o.revisionsUsed ? 'bg-ink-3' : 'bg-accent'}`} />)}</div>
          {canAct ? (
            <div className="grid gap-2 pt-1">
              <Btn kind="primary" size="l" onClick={() => setConfirm(true)}><Icon name="check" size={15} /> Duyệt bản v{o.version}</Btn>
              <Btn size="l" onClick={() => navigate(`/app/don-hang/${o.code}/sua`)}><Icon name="pin" size={15} /> Yêu cầu sửa</Btn>
            </div>
          ) : <p className="text-[13px] text-ink-3">{o.status === 'completed' ? 'Đơn đã hoàn tất.' : o.status === 'awaiting_final' ? 'Chị đã duyệt bản này.' : 'Chế độ chỉ xem — đội đang thực hiện bản tiếp theo.'}</p>}
        </section>
        <section>
          <h2 className="text-sm mb-2 flex items-center gap-1.5">Báo cáo kiểm tra · v{o.version} <AIBadge /></h2>
          <ul className="text-[13px] text-ink-2">{QC_CHECKS[o.service].map((c) => <li key={c} className="flex gap-2 items-start py-1.5 border-t border-line first:border-t-0"><Icon name="check" size={14} className="text-ok mt-0.5" />{c}</li>)}</ul>
        </section>
        {o.revisions.length > 0 && <ReviewThreads o={o} role="client" />}
        <p className="text-xs text-ink-3 leading-relaxed border-t border-line pt-3">Sản phẩm được tạo với sự hỗ trợ của AI và đã qua chuyên viên duyệt.</p>
      </aside>
      {confirm && (
        <Modal title={`Duyệt bản v${o.version}?`} onClose={() => setConfirm(false)}>
          <p className="text-[13px] text-ink-2">{rest > 0 ? <>Sau khi duyệt, chị thanh toán phần còn lại <b className="text-ink">{vnd(rest)}</b> để mở tệp gốc. </> : 'Studio sẽ đóng gói tệp gốc ngay. '}Bản này sẽ không dùng thêm lượt sửa.</p>
          {error && <p role="alert" className="text-xs text-warn bg-warn/10 rounded-r px-3 py-2">{error}</p>}
          <div className="flex gap-2 justify-end max-sm:flex-col-reverse"><Btn onClick={() => setConfirm(false)}>Để sau</Btn><Btn kind="primary" disabled={saving} onClick={() => startSaving(async () => {
            setError('')
            const result = await approveManagedDraft(o.code)
            if (!result.ok) { setError(result.error); return }
            await syncApp()
            setConfirm(false)
            navigate(result.paymentId ? `/app/thanh-toan/${result.paymentId}` : `/app/don-hang/${o.code}/tep`)
          })}>{saving ? 'Đang lưu…' : rest > 0 ? 'Duyệt & thanh toán' : 'Duyệt'}</Btn></div>
        </Modal>
      )}
    </div>
  )
}

function Payments({ o }: { o: Order }) {
  const db = useMine()
  const list = db.payments.filter((p) => p.orderCode === o.code)
  const KIND = { deposit: 'Cọc', final: 'Phần còn lại', revision: 'Lượt sửa thêm', plan: 'Gói tháng' }
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-8 max-lg:grid-cols-1">
      <section>
        {list.length === 0 ? <Empty text="Chưa có giao dịch." /> : (
          <ul>
            {list.map((p) => (
              <li key={p.id} className="flex items-center gap-4 py-3 border-b border-line max-sm:flex-wrap">
                <div className="flex-1 min-w-0"><p className="text-sm font-medium">{KIND[p.kind]}</p><p className="text-xs text-ink-3"><span className="font-mono">{p.method === 'credit' ? 'Trừ credit' : p.ref}</span> · {when(p.paidAt ?? p.createdAt)}</p></div>
                <span className="font-mono text-[13px] tabular-nums">{vnd(p.amount)}</span>
                {p.status === 'paid' ? <StatusDot status="done">Đã nhận</StatusDot> : p.status === 'pending' ? <Btn size="s" kind="primary" onClick={() => navigate(`/app/thanh-toan/${p.id}`)}>Thanh toán</Btn> : <StatusDot status="queue">Hết hạn</StatusDot>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <aside className="border border-line rounded-r2 p-4 grid gap-3 content-start">
        <h2 className="text-sm">Hóa đơn {o.code}</h2>
        <dl className="text-[13px]">
          {[['Tổng đơn', vnd(o.price.total)], ['Đã thanh toán', vnd(o.paid)], ['Còn lại', vnd(Math.max(0, o.price.total - o.paid))]].map(([k, v], i) => <div key={k} className={`flex justify-between py-2 ${i ? 'border-t border-line' : ''} ${i === 2 ? 'font-medium' : ''}`}><dt className={i === 2 ? '' : 'text-ink-3'}>{k}</dt><dd className="tabular-nums">{v}</dd></div>)}
        </dl>
        <Btn disabled={o.paid === 0}><Icon name="file" size={14} /> Tải hóa đơn PDF</Btn>
      </aside>
    </div>
  )
}

function Files({ o }: { o: Order }) {
  const svc = findService(o.service)!
  const [got, setGot] = useState<string[]>([])
  if (o.status !== 'completed') {
    return (
      <div className="border border-line rounded-r2 p-6 grid gap-2 justify-items-start max-w-[560px]">
        <Icon name="shield" size={20} className="text-ink-3" />
        <p className="text-sm font-medium">Tệp gốc mở sau khi duyệt bản cuối và thanh toán đủ</p>
        <p className="text-[13px] text-ink-3">{o.status === 'awaiting_final' ? `Còn ${vnd(o.price.total - o.paid)} — thanh toán để mở ngay.` : o.job === 'accepted' ? 'Studio đang đóng gói tệp…' : 'Trong lúc chờ, chị có thể xem bản nháp có watermark ở tab Bản nháp.'}</p>
      </div>
    )
  }
  return (
    <section className="grid gap-3 max-w-[720px]">
      <ul className="border border-line rounded-r2">
        {svc.deliverables.map((f, i) => (
          <li key={f} className="flex items-center gap-3 px-4 py-3 border-t border-line first:border-t-0">
            <span className="w-12 h-9 rounded bg-[#f4efe8] grid place-items-center overflow-hidden"><Artwork service={o.service} brand={o.brand} v={o.version} variant={i} small /></span>
            <div className="flex-1 min-w-0"><p className="text-sm">{f}</p><p className="text-xs text-ink-3 font-mono">v{o.version} · {(1.2 + i * 0.8).toFixed(1)} MB</p></div>
            <Btn size="s" onClick={() => setGot((g) => [...g, f])}>{got.includes(f) ? <><Icon name="check" size={14} /> Đã tải</> : 'Tải về'}</Btn>
          </li>
        ))}
      </ul>
      <p className="text-xs text-ink-3">Liên kết tải có hiệu lực 30 ngày. Chị có toàn quyền sử dụng thương mại.</p>
    </section>
  )
}
