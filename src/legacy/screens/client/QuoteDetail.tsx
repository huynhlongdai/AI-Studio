import { useState, useTransition } from 'react'
import { acceptManagedQuote, rejectManagedQuote } from '@/app/(frontend)/actions/commerce'
import { findService } from '../../lib/catalog'
import { navigate } from '../../router'
import { useStore, useMine } from '../../store'
import { QuoteLines } from '../../components/QuoteLines'
import { Btn, Icon, Modal, Page, PageHead, StatusDot, day, left, vnd } from '../../ui'

const REASONS = ['Giá cao hơn dự kiến', 'Cần thêm thời gian cân nhắc', 'Muốn đổi phạm vi công việc', 'Lý do khác']

export default function QuoteDetail({ code }: { code: string }) {
  const db = useMine()
  const { requote, syncApp } = useStore()
  const q = db.quotes.find((x) => x.code === code)
  const [agree, setAgree] = useState(false)
  const [rej, setRej] = useState(false)
  const [reason, setReason] = useState(REASONS[0])
  const [briefOpen, setBriefOpen] = useState(true)
  const [method, setMethod] = useState<'qr' | 'credit' | 'mix'>('qr')
  const [saving, startSaving] = useTransition()
  const [error, setError] = useState('')
  if (!q) return <Page><PageHead title="Không tìm thấy báo giá" back={() => navigate('/app/bao-gia')} /></Page>
  const svc = findService(q.service)!
  const open = q.status === 'sent' && q.expiresAt > Date.now()
  const dep = q.price.depositAmount, credit = Math.max(0, db.credit)
  const methods = [
    { id: 'qr' as const, label: 'VietQR', sub: 'Quét mã bằng app ngân hàng', ok: true },
    { id: 'credit' as const, label: 'Credit', sub: credit > 0 ? `Có ${vnd(credit)} · đang hoàn thiện đối soát` : 'Chưa có credit', ok: false },
    { id: 'mix' as const, label: 'Kết hợp', sub: 'Sẽ mở khi sổ credit được đồng bộ', ok: false },
  ]
  const accept = () => startSaving(async () => {
    setError('')
    const result = await acceptManagedQuote(q.code)
    if (!result.ok) { setError(result.error); return }
    await syncApp()
    navigate(result.paymentId ? `/app/thanh-toan/${result.paymentId}` : `/app/don-hang/${result.orderCode}`)
  })

  return (
    <Page max={960}>
      <PageHead back={() => navigate('/app/bao-gia')} title={`Báo giá ${svc.name.toLowerCase()}`} sub={<><span className="font-mono">{q.code}</span> · {q.brand} · tạo {day(q.createdAt)}</>}
        end={<StatusDot status={q.status === 'sent' ? 'wait' : q.status === 'accepted' ? 'done' : 'stop'}>{{ sent: left(q.expiresAt - Date.now()), accepted: 'Đã chấp nhận', expired: 'Đã hết hạn', rejected: 'Đã từ chối' }[q.status]}</StatusDot>} />

      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-8 max-lg:grid-cols-1">
        <div className="grid gap-6 content-start">
          <section className="border border-line rounded-r2 p-5 grid gap-4">
            <h2 className="text-sm">Hạng mục</h2>
            <QuoteLines price={q.price} />
          </section>

          <section className="border border-line rounded-r2">
            <button type="button" onClick={() => setBriefOpen((b) => !b)} aria-expanded={briefOpen} className="flex w-full items-center gap-2 px-5 py-3.5 text-sm font-medium">Tóm tắt brief<Icon name="down" size={14} className={`ml-auto transition-transform ${briefOpen ? 'rotate-180' : ''}`} /></button>
            {briefOpen && (
              <dl className="px-5 pb-4 text-[13px]">
                {[['Thương hiệu', q.brand], ['Mô tả', q.style], ['Giao hàng', q.rush ? 'Gấp trong 24 giờ' : `Tiêu chuẩn ${svc.slaDays} ngày`], ['Bàn giao', svc.deliverables.join(' · ')]].map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[100px_1fr] gap-3 py-2 border-t border-line"><dt className="text-ink-3">{k}</dt><dd>{v}</dd></div>
                ))}
              </dl>
            )}
          </section>

          <section className="grid gap-2 text-[13px] text-ink-2">
            <h2 className="text-sm text-ink">Điều khoản</h2>
            <ul className="grid gap-1.5 list-disc pl-5 marker:text-ink-3">
              <li>{svc.includedRevisions} lượt sửa miễn phí; lượt thêm tính theo bảng giá.</li>
              <li>Cọc {q.price.depositPct}% để bắt đầu; phần còn lại thanh toán khi duyệt bản cuối, trước khi mở tệp gốc.</li>
              <li>Sản phẩm được tạo với sự hỗ trợ của AI và có nhãn nội dung AI theo quy định.</li>
              <li>Chị nhận toàn quyền sử dụng thương mại sau khi thanh toán đủ.</li>
            </ul>
          </section>
        </div>

        <aside className="border border-line rounded-r2 p-5 grid gap-4 content-start self-start lg:sticky lg:top-[77px]">
          <div className="grid gap-0.5">
            <p className="text-xs text-ink-3">{q.price.depositPct === 100 ? 'Thanh toán trước' : `Cọc ${q.price.depositPct}% hôm nay`}</p>
            <p className="text-2xl font-medium tabular-nums">{q.price.depositAmount.toLocaleString('vi-VN')}đ</p>
            <p className="text-xs text-ink-3">trên tổng {q.price.total.toLocaleString('vi-VN')}đ</p>
          </div>
          {open && (
            <>
              <fieldset className="grid gap-1.5">
                <legend className="text-xs text-ink-3 mb-1.5">Phương thức</legend>
                {methods.map((m) => (
                  <label key={m.id} className={`flex gap-2.5 items-start border rounded-r p-2.5 text-[13px] ${!m.ok ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'} ${method === m.id ? 'border-accent' : 'border-line hover:bg-side'}`}>
                    <input type="radio" name="method" disabled={!m.ok} checked={method === m.id} onChange={() => setMethod(m.id)} className="mt-0.5 accent-accent" />
                    <span><span className="block font-medium">{m.label}</span><span className="block text-xs text-ink-3">{m.sub}</span></span>
                  </label>
                ))}
              </fieldset>
              <label className="flex gap-2.5 items-start text-[13px] text-ink-2 cursor-pointer">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-4 accent-accent" />
                Tôi đồng ý với điều khoản, gồm việc sản phẩm có sự hỗ trợ của AI.
              </label>
              {error && <p role="alert" className="text-xs text-warn bg-warn/10 rounded-r px-3 py-2">{error}</p>}
              <Btn kind="primary" size="l" disabled={!agree || saving} onClick={accept}>{saving ? 'Đang tạo đơn…' : 'Chấp nhận & thanh toán cọc'}</Btn>
              <Btn size="l" kind="plain" onClick={() => setRej(true)}>Từ chối báo giá</Btn>
            </>
          )}
          {q.status === 'accepted' && <Btn kind="primary" size="l" onClick={() => navigate(`/app/don-hang/${q.orderCode}`)}>Xem đơn {q.orderCode}</Btn>}
          {q.status === 'expired' && <><p className="text-[13px] text-ink-3">Báo giá đã hết hạn. Giá có thể thay đổi theo bảng giá mới.</p><Btn kind="primary" size="l" onClick={() => navigate(`/app/bao-gia/${requote(q.code)}`)}>Yêu cầu báo giá lại</Btn></>}
          {q.status === 'rejected' && <p className="text-[13px] text-ink-3">Chị đã từ chối: {q.rejectReason}</p>}
          <p className="text-xs text-ink-3 flex gap-1.5 items-center"><Icon name="shield" size={13} /> Thanh toán VietQR qua payOS</p>
        </aside>
      </div>

      {rej && (
        <Modal title="Từ chối báo giá?" onClose={() => setRej(false)}>
          <fieldset className="grid gap-1.5">
            <legend className="text-[13px] text-ink-3 mb-1.5">Lý do giúp studio cải thiện báo giá</legend>
            {REASONS.map((r) => (
              <label key={r} className="flex gap-2.5 items-center text-[13px] min-h-9 px-2 rounded-r hover:bg-soft cursor-pointer"><input type="radio" name="r" checked={reason === r} onChange={() => setReason(r)} className="accent-accent" />{r}</label>
            ))}
          </fieldset>
          {error && <p role="alert" className="text-xs text-warn bg-warn/10 rounded-r px-3 py-2">{error}</p>}
          <div className="flex gap-2 justify-end"><Btn onClick={() => setRej(false)}>Hủy</Btn><Btn kind="primary" disabled={saving} onClick={() => startSaving(async () => {
            setError('')
            const result = await rejectManagedQuote(q.code, reason)
            if (!result.ok) { setError(result.error ?? 'Chưa thể từ chối báo giá.'); return }
            await syncApp()
            setRej(false)
          })}>{saving ? 'Đang lưu…' : 'Từ chối'}</Btn></div>
        </Modal>
      )}
    </Page>
  )
}
