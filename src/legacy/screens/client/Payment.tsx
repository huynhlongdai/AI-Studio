import { useEffect, useMemo, useState, useTransition } from 'react'
import { renewManagedPayment } from '@/app/(frontend)/actions/payment'
import { findPlan, findService } from '../../lib/catalog'
import { navigate } from '../../router'
import { useStore, useMine } from '../../store'
import { Btn, Icon, Page, PageHead, vnd } from '../../ui'

/** Decorative QR matrix seeded by the reference; production renders the gateway's real VietQR payload. */
function FakeQR({ seed }: { seed: string }) {
  const cells = useMemo(() => {
    let s = [...seed].reduce((a, c) => a + c.charCodeAt(0), 7)
    return Array.from({ length: 625 }, () => ((s = (s * 9301 + 49297) % 233280) / 233280) > 0.52)
  }, [seed])
  const inF = (x: number, y: number) => (x < 8 && y < 8) || (x > 16 && y < 8) || (x < 8 && y > 16)
  const finder = (x: number, y: number) => <g key={`${x}-${y}`}><rect x={x} y={y} width="7" height="7" fill="#171717" /><rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" /><rect x={x + 2} y={y + 2} width="3" height="3" fill="#171717" /></g>
  return (
    <svg viewBox="0 0 25 25" className="w-full h-full" shapeRendering="crispEdges" aria-label="Mã VietQR">
      <rect width="25" height="25" fill="#fff" />
      {cells.map((on, i) => { const x = i % 25, y = Math.floor(i / 25); return on && !inF(x, y) ? <rect key={i} x={x} y={y} width="1" height="1" fill="#171717" /> : null })}
      {[finder(0, 0), finder(18, 0), finder(0, 18)]}
    </svg>
  )
}

function Copy({ label, value, mono = false, strong = false }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
  const [ok, setOk] = useState(false)
  return (
    <div className="flex items-center gap-3 py-2.5 border-t border-line first:border-t-0">
      <div className="flex-1 min-w-0"><p className="text-xs text-ink-3">{label}</p><p className={`${mono ? 'font-mono' : ''} ${strong ? 'text-base font-medium' : 'text-sm'} truncate tabular-nums`}>{value}</p></div>
      <button type="button" onClick={() => { navigator.clipboard?.writeText(value.replace(/[.đ\s]/g, mono ? '' : ' ').trim()); setOk(true); setTimeout(() => setOk(false), 1400) }} className="inline-flex items-center gap-1 text-[13px] text-accent font-medium min-h-8 max-md:min-h-11 px-2 rounded-r hover:bg-soft" aria-label={`Sao chép ${label}`}>
        <Icon name={ok ? 'check' : 'copy'} size={14} /> {ok ? 'Đã chép' : 'Chép'}
      </button>
    </div>
  )
}

const KIND = { deposit: 'Thanh toán cọc', final: 'Thanh toán phần còn lại', revision: 'Mua thêm lượt sửa', plan: 'Mua gói tháng' }

export default function Payment({ id }: { id: string }) {
  const db = useMine()
  const { db: all, payFinalWithCredit, syncApp } = useStore()
  const cfg = all.settings
  const p = db.payments.find((x) => x.id === id)
  const [now, setNow] = useState(Date.now())
  const [renewing, startRenewing] = useTransition()
  const [error, setError] = useState('')
  const [shared, setShared] = useState(false)
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  useEffect(() => {
    if (p?.status !== 'pending') return
    const timer = setInterval(() => { void syncApp() }, 5000)
    return () => clearInterval(timer)
  }, [p?.status])
  if (!p) return <Page><PageHead title="Không tìm thấy giao dịch" back={() => navigate('/app')} /></Page>
  const o = p.orderCode ? db.orders.find((x) => x.code === p.orderCode) : undefined
  const plan = p.planCode ? findPlan(p.planCode) : undefined
  const svc = o ? findService(o.service)! : undefined
  const ms = Math.max(0, p.expiresAt - now)
  const mm = String(Math.floor(ms / 60000)).padStart(2, '0'), ss = String(Math.floor(ms / 1000) % 60).padStart(2, '0')
  const back = o ? `/app/don-hang/${o.code}${p.kind === 'revision' ? '/sua' : ''}` : '/app/goi'
  const subtitle = o && svc ? <>Đơn <span className="font-mono">{o.code}</span> · {svc.name} · {o.brand}</> : <>Gói {plan?.name} · nhận {vnd(plan?.credit ?? 0)} credit</>
  const canCredit = p.kind === 'final' && db.credit >= p.amount

  const sharePayment = async () => {
    const text = `${cfg.bankName}\nSố tài khoản: ${cfg.bankAccount}\nChủ tài khoản: ${cfg.accountName}\nSố tiền: ${vnd(p.amount)}\nNội dung: ${p.ref}`
    try {
      if (navigator.share) await navigator.share({ title: 'Thông tin chuyển khoản AI Studio', text })
      else await navigator.clipboard.writeText(text)
      setShared(true)
      setTimeout(() => setShared(false), 1800)
    } catch {
      // The native share sheet can be dismissed without changing payment state.
    }
  }

  if (p.status === 'paid') {
    const next = p.kind === 'plan' ? `Gói ${plan?.name} đã kích hoạt, credit đã vào tài khoản.` : p.kind === 'deposit' ? `Đơn ${o!.code} đã vào hàng chờ và sẽ bắt đầu ngay.` : p.kind === 'final' ? 'Studio đang đóng gói tệp gốc cho chị — chỉ mất vài giây.' : 'Chị đã có thêm 1 lượt sửa. Quay lại để gửi góp ý.'
    return (
      <div className="px-8 py-16 max-md:px-4 max-w-[520px] mx-auto w-full grid gap-5 text-center justify-items-center enter">
        <span className="size-12 rounded-full bg-ok/10 text-ok grid place-items-center"><Icon name="check" size={22} /></span>
        <div className="grid gap-1.5"><h1 className="text-xl">Đã nhận {vnd(p.amount)}</h1><p className="text-[13px] text-ink-3">{next}</p></div>
        <div className="flex gap-2 max-sm:flex-col max-sm:w-full">
          <Btn kind="primary" size="l" onClick={() => navigate(p.kind === 'final' ? `/app/don-hang/${o!.code}/tep` : back)}>{p.kind === 'plan' ? 'Xem gói & credit' : p.kind === 'final' ? 'Đến mục tệp' : p.kind === 'revision' ? 'Gửi góp ý' : 'Xem tiến độ đơn'}</Btn>
          {o && <Btn size="l" onClick={() => navigate(`/app/don-hang/${o.code}/thanh-toan`)}>Xem hóa đơn</Btn>}
        </div>
      </div>
    )
  }
  const expired = p.status === 'expired' || ms === 0

  return (
    <Page max={920}>
      <PageHead back={() => navigate(back)} title={KIND[p.kind]} sub={subtitle} />
      {canCredit && p.status === 'pending' && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-r2 bg-soft text-[13px] max-sm:flex-wrap"><Icon name="card" /><p className="flex-1">Chị có <b>{vnd(db.credit)}</b> credit — đủ để trả khoản này mà không cần chuyển khoản.</p><Btn size="s" kind="primary" onClick={() => { payFinalWithCredit(o!.code); navigate(`/app/don-hang/${o!.code}/tep`) }}>Trả bằng credit</Btn></div>
      )}
      <div className="grid grid-cols-[300px_minmax(0,1fr)] gap-8 max-md:grid-cols-1 max-md:gap-6">
        <section className="border border-line rounded-r2 p-5 grid gap-4 justify-items-center text-center content-start">
          <p className="font-medium text-sm">Viet<span className="text-[#e3242b]">QR</span> <span className="text-ink-3 font-normal">· quét bằng app ngân hàng</span></p>
          <div className={`relative size-[200px] p-2.5 border border-line rounded-r2 transition-opacity ${expired ? 'opacity-25' : ''}`}><FakeQR seed={p.id} /></div>
          {expired ? (
            <div className="grid gap-2 justify-items-center">
              <p className="text-[13px] text-warn">Mã đã hết hạn — chưa có tiền nào bị trừ.</p>
              <Btn kind="primary" disabled={renewing} onClick={() => startRenewing(async () => {
                setError('')
                const result = await renewManagedPayment(p.id)
                if (!result.ok || !result.paymentId) { setError(result.ok ? 'Chưa thể tạo mã mới.' : result.error); return }
                await syncApp()
                navigate(`/app/thanh-toan/${result.paymentId}`)
              })}>{renewing ? 'Đang tạo…' : 'Tạo mã mới'}</Btn>
            </div>
          ) : (
            <>
              <p className="text-2xl font-medium tabular-nums">{vnd(p.amount)}</p>
              <p className="inline-flex items-center gap-2 text-[13px] text-ink-2"><span className="size-2 rounded-full bg-accent live" /> Đang chờ thanh toán · <span className="font-mono text-ink">{mm}:{ss}</span></p>
              <Btn size="l" className="w-full md:hidden" onClick={sharePayment}><Icon name={shared ? 'check' : 'phone'} size={15} /> {shared ? 'Đã mở chia sẻ' : 'Chia sẻ thông tin thanh toán'}</Btn>
            </>
          )}
          {error && <p role="alert" className="text-xs text-warn">{error}</p>}
        </section>

        <section className="grid gap-6 content-start">
          <div className="border border-line rounded-r2 px-4 py-1.5">
            <Copy label="Ngân hàng" value={cfg.bankName} />
            <Copy label="Số tài khoản" value={cfg.bankAccount} mono />
            <Copy label="Chủ tài khoản" value={cfg.accountName} />
            <Copy label="Số tiền" value={vnd(p.amount)} mono strong />
            <div className="border-t border-line">
              <Copy label="Nội dung chuyển khoản" value={p.ref} mono strong />
              <p className="text-xs text-warn flex gap-1.5 items-center pb-2.5"><Icon name="shield" size={13} /> Giữ nguyên nội dung để hệ thống tự xác nhận.</p>
            </div>
          </div>
          <ol className="grid gap-3 text-[13px] text-ink-2">
            {['Mở app ngân hàng, chọn quét mã QR.', `Kiểm tra số tiền và nội dung ${p.ref}.`, 'Xác nhận chuyển — trang này tự chuyển trạng thái khi ngân hàng báo về, không cần gửi ảnh chụp.'].map((s, i) => (
              <li key={i} className="flex gap-3"><span className="size-5 rounded-full border border-line grid place-items-center font-mono text-xs text-ink-3 flex-none">{i + 1}</span>{s}</li>
            ))}
          </ol>
          <div className="flex items-center gap-2 text-xs text-ink-3 border-t border-line pt-4 flex-wrap">
            <Icon name="shield" size={13} /> Bản thật xác nhận qua webhook {cfg.gateway} đã ký · không lưu thông tin thẻ
          </div>
        </section>
      </div>
    </Page>
  )
}
