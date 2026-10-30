import { useEffect, useRef, useState, useTransition } from 'react'
import { findService } from '../../lib/catalog'
import { useVoiceInput } from '../../lib/useVoiceInput'
import { navigate } from '../../router'
import { isRevisionBlocked, revisionsLeft, useStore, useMine, type Annot, type Order, type ReviewViewport } from '../../store'
import { Artwork } from '../../components/Artwork'
import { Btn, Icon, Modal, Page, PageHead, vnd } from '../../ui'
import { persistReviewBatch } from '@/app/(frontend)/actions/review'
import { createManagedRevisionPayment } from '@/app/(frontend)/actions/payment'

type Mode = 'pin' | 'region'
type Draft = { annots: Annot[]; note: string; asset: number; viewport: ReviewViewport; capture?: string; captureAsset?: number; captureViewport?: ReviewViewport }

const viewportLabel: Record<ReviewViewport, string> = { desktop: 'Desktop', tablet: 'Tablet', mobile: 'Mobile' }

export default function Revise({ code }: { code: string }) {
  const db = useMine()
  const { db: all } = useStore()
  const o = db.orders.find((x) => x.code === code)
  if (!o) return <Page><PageHead title="Không tìm thấy đơn" back={() => navigate('/app/don-hang')} /></Page>
  const back = () => navigate(`/app/don-hang/${o.code}/ban-nhap`)
  if (o.job !== 'client_review') return <Page><PageHead back={back} title="Bản nháp này không còn chờ góp ý" sub="Đơn đang ở bước khác." /></Page>
  return <ReviewStudio o={o} extraRevision={all.settings.extraRevision} />
}

function ReviewStudio({ o, extraRevision }: { o: Order; extraRevision: number }) {
  const { requestRevision, syncApp } = useStore()
  const svc = findService(o.service)!
  const key = `ais-review-draft:${o.code}:v${o.version}`
  const [buying, startBuying] = useTransition()
  const [paymentError, setPaymentError] = useState('')
  const initial = (): Draft => {
    try {
      const saved = localStorage.getItem(key)
      if (saved) return JSON.parse(saved) as Draft
    } catch { /* use an empty draft */ }
    return { annots: [], note: '', asset: 0, viewport: 'desktop' }
  }
  const draft = initial()
  const [annots, setAnnots] = useState<Annot[]>(draft.annots)
  const [active, setActive] = useState<number | null>(draft.annots.at(-1)?.id ?? null)
  const [note, setNote] = useState(draft.note)
  const [asset, setAsset] = useState(draft.asset)
  const [viewport, setViewport] = useState<ReviewViewport>(draft.viewport)
  const [capture, setCapture] = useState<string | undefined>(draft.capture)
  const [captureAsset, setCaptureAsset] = useState(draft.captureAsset)
  const [captureViewport, setCaptureViewport] = useState<ReviewViewport | undefined>(draft.captureViewport)
  const [mode, setMode] = useState<Mode>('pin')
  const [showPins, setShowPins] = useState(true)
  const [regionStart, setRegionStart] = useState<{ x: number; y: number } | null>(null)
  const [regionNow, setRegionNow] = useState<{ x: number; y: number } | null>(null)
  const [err, setErr] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [saving, setSaving] = useState(false)
  const surface = useRef<HTMLDivElement>(null)
  const blocked = isRevisionBlocked(o)
  const left = revisionsLeft(o)
  const activeAnnot = annots.find((a) => a.id === active)
  const visible = annots.filter((a) => (a.asset ?? 0) === asset && (a.viewport ?? 'desktop') === viewport)
  const voice = useVoiceInput((text) => {
    if (active) update(active, { text: [activeAnnot?.text.trim(), text].filter(Boolean).join(' ') })
  })

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify({ annots, note, asset, viewport, capture, captureAsset, captureViewport } satisfies Draft))
  }, [key, annots, note, asset, viewport, capture, captureAsset, captureViewport])

  const point = (e: { clientX: number; clientY: number }) => {
    const r = surface.current!.getBoundingClientRect()
    return { x: Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)), y: Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100)) }
  }
  const add = (p: { x: number; y: number }, region?: Annot['region']) => {
    const id = Date.now()
    setAnnots((list) => [...list, { id, x: p.x, y: p.y, text: '', kind: region ? 'region' : 'pin', region, asset, assetLabel: svc.deliverables[asset], viewport, status: 'open', replies: [] }])
    setActive(id)
    setErr('')
  }
  function update(id: number, patch: Partial<Annot>) {
    setAnnots((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  }
  const remove = (id: number) => {
    setAnnots((list) => list.filter((a) => a.id !== id))
    if (active === id) setActive(null)
  }
  const onPointerDown = (e: React.PointerEvent) => {
    if (mode !== 'region' || (e.target as HTMLElement).closest('button')) return
    const p = point(e)
    setRegionStart(p)
    setRegionNow(p)
    surface.current?.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (regionStart) setRegionNow(point(e))
  }
  const onPointerUp = (e: React.PointerEvent) => {
    if (mode === 'pin') return
    if (!regionStart) return
    const end = point(e)
    const x = Math.min(regionStart.x, end.x), y = Math.min(regionStart.y, end.y)
    const width = Math.abs(end.x - regionStart.x), height = Math.abs(end.y - regionStart.y)
    if (width > 2 && height > 2) add({ x, y }, { x, y, width, height })
    setRegionStart(null)
    setRegionNow(null)
  }
  const takeCapture = async () => {
    if (!surface.current) return
    setCapturing(true)
    setShowPins(false)
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    try {
      const { default: html2canvas } = await import('html2canvas')
      const source = await html2canvas(surface.current, { backgroundColor: '#f4efe8', scale: Math.min(devicePixelRatio, 1.5), useCORS: true, logging: false })
      const max = 720, ratio = Math.min(1, max / source.width)
      const out = document.createElement('canvas')
      out.width = Math.round(source.width * ratio)
      out.height = Math.round(source.height * ratio)
      out.getContext('2d')!.drawImage(source, 0, 0, out.width, out.height)
      setCapture(out.toDataURL('image/jpeg', 0.72))
      setCaptureAsset(asset)
      setCaptureViewport(viewport)
    } catch {
      setErr('Không thể chụp vùng review. Bạn có thể tiếp tục gửi các ghim góp ý.')
    } finally {
      setShowPins(true)
      setCapturing(false)
    }
  }
  const submit = async () => {
    const clean = annots.filter((a) => a.text.trim())
    setSaving(true)
    const persisted = await persistReviewBatch({
      order: {
        code: o.code,
        serviceCode: o.service,
        brand: o.brand,
        brief: o.style,
        total: o.price.total,
        includedRevisions: o.includedRevisions,
        dueAt: new Date(o.dueAt).toISOString(),
        version: o.version,
      },
      annotations: clean.map((a) => ({ ...a, region: a.region ? { width: a.region.width, height: a.region.height } : undefined })),
      capture,
      captureAsset,
      captureViewport,
    })
    setSaving(false)
    if (!persisted.ok) { setConfirm(false); setErr(persisted.error); return }
    const result = requestRevision(o.code, clean, note, { capture, captureAsset, viewport: captureViewport })
    if (result === 'invalid') { setConfirm(false); setErr('Thêm ít nhất 1 comment có nội dung, hoặc ghi chú chung từ 10 ký tự.'); return }
    if (result === 'ok') {
      localStorage.removeItem(key)
      navigate(`/app/don-hang/${o.code}`)
    }
  }
  const frameWidth = viewport === 'mobile' ? 'max-w-[390px]' : viewport === 'tablet' ? 'max-w-[720px]' : 'max-w-[980px]'

  return (
    <Page max={1480}>
      <PageHead back={() => navigate(`/app/don-hang/${o.code}/ban-nhap`)} title={`Review Studio · bản v${o.version}`} sub={<><span className="font-mono">{o.code}</span> · Ghim, khoanh vùng hoặc capture nơi cần thay đổi</>} />

      <div className="sticky top-[53px] z-20 -mx-8 max-md:-mx-4 px-8 max-md:px-4 py-2.5 bg-white/95 border-y border-line flex items-center gap-2 flex-wrap">
        <div role="group" aria-label="Công cụ góp ý" className="flex p-0.5 gap-0.5 border border-line rounded-r">
          <button type="button" aria-pressed={mode === 'pin'} onClick={() => setMode('pin')} className={`h-8 px-3 rounded inline-flex items-center gap-1.5 text-[13px] ${mode === 'pin' ? 'bg-ink text-white' : 'hover:bg-soft text-ink-2'}`}><Icon name="pin" size={14} /> Ghim</button>
          <button type="button" aria-pressed={mode === 'region'} onClick={() => setMode('region')} className={`h-8 px-3 rounded inline-flex items-center gap-1.5 text-[13px] ${mode === 'region' ? 'bg-ink text-white' : 'hover:bg-soft text-ink-2'}`}><Icon name="region" size={14} /> Khoanh vùng</button>
        </div>
        <div role="group" aria-label="Kích thước xem trước" className="flex p-0.5 gap-0.5 border border-line rounded-r">
          {(['desktop', 'tablet', 'mobile'] as ReviewViewport[]).map((v) => <button key={v} type="button" aria-pressed={viewport === v} onClick={() => setViewport(v)} className={`size-8 rounded grid place-items-center ${viewport === v ? 'bg-hover text-ink' : 'text-ink-3 hover:bg-soft'}`} title={viewportLabel[v]}><Icon name={v === 'mobile' ? 'phone' : v} size={15} /></button>)}
        </div>
        <button type="button" onClick={() => setShowPins((s) => !s)} className="h-8 px-2.5 rounded-r text-[13px] text-ink-2 hover:bg-soft inline-flex items-center gap-1.5"><Icon name="eye" size={14} /> {showPins ? 'Ẩn ghim' : 'Hiện ghim'}</button>
        <button type="button" onClick={takeCapture} disabled={capturing} className="h-8 px-2.5 rounded-r text-[13px] text-ink-2 hover:bg-soft inline-flex items-center gap-1.5 disabled:opacity-40"><Icon name="camera" size={14} /> {capturing ? 'Đang chụp…' : 'Capture màn này'}</button>
        <span className="ml-auto text-xs text-ink-3">{mode === 'pin' ? 'Bấm vào nội dung để đặt ghim' : 'Kéo để khoanh vùng cần sửa'}</span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-6 max-xl:grid-cols-1">
        <section className="min-w-0 grid gap-3 content-start">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1" aria-label="Tệp cần review">
            {svc.deliverables.map((label, i) => <button key={label} type="button" onClick={() => { setAsset(i); setActive(null) }} aria-pressed={asset === i} className={`flex-none min-h-9 px-3 border rounded-r text-[13px] ${asset === i ? 'border-accent text-ink bg-accent/5' : 'border-line text-ink-2 hover:bg-soft'}`}>{label}<span className="ml-1.5 text-xs text-ink-3">{annots.filter((a) => (a.asset ?? 0) === i).length || ''}</span></button>)}
          </div>

          <div className={`mx-auto w-full ${frameWidth} transition-[max-width] duration-300`}>
            <div className="rounded-t-r2 border border-line bg-side px-3 py-2 flex items-center gap-1.5 text-xs text-ink-3">
              <span className="size-2 rounded-full bg-line" /><span className="size-2 rounded-full bg-line" /><span className="size-2 rounded-full bg-line" />
              <span className="mx-auto truncate px-4">{o.service === 'landing' ? `preview.${o.brand.toLowerCase().replace(/\s+/g, '')}.vn` : `${svc.deliverables[asset]} · ${viewportLabel[viewport]}`}</span>
            </div>
            <div
              ref={surface}
              onClick={(e) => { if (mode === 'pin' && !(e.target as HTMLElement).closest('button')) add(point(e)) }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              role="application"
              aria-label="Khung review — bấm hoặc kéo để thêm góp ý"
              className={`relative border-x border-b border-line rounded-b-r2 bg-[#f4efe8] overflow-hidden select-none ${mode === 'pin' ? 'cursor-crosshair touch-pan-y' : 'cursor-cell touch-none'} ${o.service === 'landing' ? '' : 'aspect-[3/2]'}`}
            >
              {o.service === 'landing' ? <LandingPreview brand={o.brand} version={o.version} compact={viewport === 'mobile'} /> : <div className="w-full h-full grid place-items-center p-10 pointer-events-none"><Artwork service={o.service} brand={o.brand} v={o.version} variant={asset} /></div>}
              {showPins && visible.map((a) => {
                const n = annots.indexOf(a) + 1
                return a.kind === 'region' && a.region ? (
                  <button key={a.id} type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setActive(a.id) }} style={{ left: `${a.region.x}%`, top: `${a.region.y}%`, width: `${a.region.width}%`, height: `${a.region.height}%` }} aria-label={`Vùng góp ý ${n}`} className={`absolute border-2 rounded-r bg-accent/10 ${active === a.id ? 'border-ink' : 'border-accent'}`}><span className="absolute -top-3 -left-3 size-6 rounded-full bg-accent text-white text-xs grid place-items-center shadow-md">{n}</span></button>
                ) : (
                  <button key={a.id} type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setActive(a.id) }} style={{ left: `${a.x}%`, top: `${a.y}%` }} aria-label={`Ghim ${n}`} className={`absolute -translate-x-1/2 -translate-y-1/2 size-7 rounded-full text-xs font-medium grid place-items-center border-2 border-white shadow-md enter ${active === a.id ? 'bg-ink text-white' : 'bg-accent text-white'}`}>{n}</button>
                )
              })}
              {regionStart && regionNow && <span className="absolute border-2 border-dashed border-accent bg-accent/10 pointer-events-none" style={{ left: `${Math.min(regionStart.x, regionNow.x)}%`, top: `${Math.min(regionStart.y, regionNow.y)}%`, width: `${Math.abs(regionNow.x - regionStart.x)}%`, height: `${Math.abs(regionNow.y - regionStart.y)}%` }} />}
              {visible.length === 0 && <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs bg-white/90 rounded-r px-2.5 py-1 text-ink-2 inline-flex items-center gap-1.5 pointer-events-none"><Icon name={mode === 'pin' ? 'pin' : 'region'} size={13} /> {mode === 'pin' ? 'Bấm vào chỗ cần sửa' : 'Kéo quanh vùng cần sửa'}</span>}
            </div>
          </div>
        </section>

        <aside className="grid gap-4 content-start xl:sticky xl:top-[118px]">
          <div className={`flex items-center justify-between rounded-r2 px-4 py-3 text-[13px] ${left <= 1 ? 'bg-warn/10' : 'bg-soft'}`}>
            <span>Lượt sửa còn lại</span><b className="font-mono">{left} / {o.includedRevisions + o.extraRevisions}</b>
          </div>
          {capture && (
            <section className="border border-line rounded-r2 p-2.5 grid gap-2">
              <div className="flex items-center gap-2"><p className="text-xs text-ink-3 flex-1">Capture · {svc.deliverables[captureAsset ?? 0]} · {viewportLabel[captureViewport ?? 'desktop']}</p><button type="button" onClick={() => setCapture(undefined)} className="text-xs text-ink-3 hover:text-ink">Xóa</button></div>
              <img src={capture} alt="Ảnh capture vùng review" className="w-full max-h-36 object-cover object-top rounded-r border border-line" />
            </section>
          )}
          <section className="grid gap-2">
            <div className="flex items-center"><h2 className="text-sm">Comment <span className="text-ink-3 font-normal">{annots.length}</span></h2><span className="ml-auto text-xs text-ink-3">Tự lưu bản nháp</span></div>
            {annots.length === 0 ? <p className="text-[13px] text-ink-3 border border-dashed border-line rounded-r2 p-4">Chưa có comment. Dùng Ghim hoặc Khoanh vùng rồi bấm vào bản nháp.</p> : (
              <ol className="grid gap-2 max-h-[52dvh] overflow-auto pr-1">
                {annots.map((a, i) => (
                  <li key={a.id} className={`border rounded-r2 p-3 grid gap-2 ${active === a.id ? 'border-accent bg-accent/[.025]' : 'border-line'}`}>
                    <button type="button" onClick={() => { setAsset(a.asset ?? 0); setViewport(a.viewport ?? 'desktop'); setActive(a.id) }} className="flex items-center gap-2 text-left">
                      <span className="size-5 rounded-full bg-accent text-white text-xs grid place-items-center">{i + 1}</span>
                      <span className="text-xs text-ink-3 truncate">{a.kind === 'region' ? 'Vùng' : 'Ghim'} · {a.assetLabel ?? svc.deliverables[0]} · {viewportLabel[a.viewport ?? 'desktop']}</span>
                      <span onClick={(e) => { e.stopPropagation(); remove(a.id) }} className="ml-auto text-xs text-ink-3 hover:text-ink px-1.5">Xóa</span>
                    </button>
                    <textarea autoFocus={active === a.id && !a.text} value={a.text} onFocus={() => setActive(a.id)} onChange={(e) => update(a.id, { text: e.target.value })} rows={3} placeholder="Vị trí này cần thay đổi gì?" className="w-full resize-none text-[13px] outline-none bg-transparent placeholder:text-ink-3" />
                    {active === a.id && <button type="button" onClick={voice.toggle} disabled={!voice.supported} className={`justify-self-start min-h-7 px-2 rounded-r inline-flex items-center gap-1.5 text-xs ${voice.listening ? 'bg-accent/10 text-accent' : 'text-ink-3 hover:bg-soft'}`}><Icon name="mic" size={13} />{voice.listening ? 'Đang nghe…' : 'Nói comment'}</button>}
                  </li>
                ))}
              </ol>
            )}
          </section>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Ghi chú chung</span>
            <textarea value={note} onChange={(e) => { setNote(e.target.value); setErr('') }} rows={3} placeholder="Ví dụ: màu tổng thể ấm hơn một chút" className="w-full border border-line rounded-r2 p-2.5 text-[13px] outline-none focus:border-[#d4d4d4] resize-none placeholder:text-ink-3" />
          </label>
          {(err || voice.error) && <p role="alert" className="text-[13px] text-warn">{err || voice.error}</p>}
          <Btn kind="primary" size="l" disabled={!annots.some((a) => a.text.trim()) && note.trim().length < 10} onClick={() => setConfirm(true)}>Gửi {annots.filter((a) => a.text.trim()).length || ''} yêu cầu sửa</Btn>
          <p className="text-xs text-ink-3">Mọi comment trong lần gửi này chỉ tính là 1 lượt sửa. Thay đổi ngoài phạm vi có thể cần báo giá mới.</p>
        </aside>
      </div>

      {confirm && (blocked ? (
        <Modal title="Đã dùng hết lượt sửa miễn phí" onClose={() => setConfirm(false)}>
          <p className="text-[13px] text-ink-2">Bạn có thể mua thêm 1 lượt sửa với giá <b className="text-ink">{vnd(extraRevision)}</b>. Bản nháp comment vẫn được giữ nguyên.</p>
          {paymentError && <p role="alert" className="text-xs text-warn bg-warn/10 rounded-r px-3 py-2">{paymentError}</p>}
          <div className="flex gap-2 justify-end"><Btn onClick={() => setConfirm(false)}>Để sau</Btn><Btn kind="primary" disabled={buying} onClick={() => startBuying(async () => {
            setPaymentError('')
            const result = await createManagedRevisionPayment(o.code)
            if (!result.ok || !result.paymentId) { setPaymentError(result.ok ? 'Chưa thể tạo giao dịch.' : result.error); return }
            await syncApp()
            navigate(`/app/thanh-toan/${result.paymentId}`)
          })}>{buying ? 'Đang tạo…' : 'Mua lượt sửa'}</Btn></div>
        </Modal>
      ) : (
        <Modal title={`Gửi ${annots.filter((a) => a.text.trim()).length} comment cho bản v${o.version}?`} onClose={() => setConfirm(false)}>
          <p className="text-[13px] text-ink-2">Các comment sẽ được gửi thành một nhóm và dùng 1 lượt sửa, còn lại {left - 1}. Bạn vẫn có thể trao đổi trong từng comment sau khi gửi.</p>
          <div className="flex gap-2 justify-end"><Btn onClick={() => setConfirm(false)} disabled={saving}>Xem lại</Btn><Btn kind="primary" onClick={submit} disabled={saving}>{saving ? 'Đang lưu…' : 'Gửi yêu cầu sửa'}</Btn></div>
        </Modal>
      ))}
    </Page>
  )
}

function LandingPreview({ brand, version, compact }: { brand: string; version: number; compact: boolean }) {
  return (
    <div className="bg-white text-ink pointer-events-none">
      <header className="h-14 px-6 flex items-center border-b border-line"><b className="font-medium">{brand}</b><span className="ml-auto text-xs text-ink-3">{compact ? 'Menu' : 'Giới thiệu · Dịch vụ · Liên hệ'}</span></header>
      <section className={`bg-side ${compact ? 'px-6 py-12' : 'px-12 py-16 grid grid-cols-[1.1fr_.9fr] gap-10'} items-center`}>
        <div className="grid gap-4"><p className="text-xs text-accent font-medium">TRẢI NGHIỆM MỚI</p><h2 className={`${compact ? 'text-3xl' : 'text-4xl'} leading-tight`}>{version > 1 ? 'Một trải nghiệm tốt hơn cho khách hàng' : `Chào mừng đến ${brand}`}</h2><p className="text-[13px] text-ink-2 max-w-md">Giải pháp được thiết kế riêng, dễ dùng trên mọi thiết bị và sẵn sàng chuyển đổi khách truy cập thành khách hàng.</p><span className="justify-self-start bg-accent text-white rounded-r px-4 py-2 text-[13px]">Bắt đầu ngay</span></div>
        {!compact && <div className="h-52 rounded-r2 bg-accent/10 border border-accent/20 grid place-items-center"><Icon name="spark" size={40} className="text-accent" /></div>}
      </section>
      <section className="px-6 py-12 grid gap-7"><div className="text-center grid gap-1"><h3 className="text-xl">Điểm nổi bật</h3><p className="text-[13px] text-ink-3">Mọi thứ khách hàng cần trong một trang rõ ràng.</p></div><div className={`grid ${compact ? 'grid-cols-1' : 'grid-cols-3'} gap-3`}>{['Nhanh chóng', 'Dễ sử dụng', 'Hỗ trợ tận tâm'].map((x, i) => <article key={x} className="border border-line rounded-r2 p-5 grid gap-2"><span className="size-8 rounded-r bg-soft grid place-items-center text-accent"><Icon name={i === 0 ? 'pulse' : i === 1 ? 'check' : 'chat'} /></span><h4 className="text-sm font-medium">{x}</h4><p className="text-xs text-ink-3">Nội dung mẫu để review bố cục, khoảng cách và trải nghiệm responsive.</p></article>)}</div></section>
      <section className={`mx-6 mb-10 rounded-r2 bg-ink text-white ${compact ? 'p-6' : 'p-10 flex items-center'} gap-6`}><div><h3 className="text-xl">Sẵn sàng bắt đầu?</h3><p className="text-[13px] text-white/60 mt-1">Để lại thông tin, đội ngũ sẽ liên hệ trong ngày.</p></div><span className={`${compact ? 'mt-5' : 'ml-auto'} inline-block bg-white text-ink rounded-r px-4 py-2 text-[13px]`}>Đăng ký tư vấn</span></section>
      <footer className="border-t border-line px-6 py-6 text-xs text-ink-3">© 2026 {brand} · Chính sách quyền riêng tư</footer>
    </div>
  )
}
