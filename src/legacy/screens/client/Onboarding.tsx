import { useState, useTransition } from 'react'
import { updateAppProfile } from '@/app/(frontend)/actions/appAuth'
import { navigate } from '../../router'
import { useMine, useStore, type Customer } from '../../store'
import { Btn, Icon } from '../../ui'

const INDUSTRIES = ['Cà phê · F&B', 'Bánh ngọt', 'Làm đẹp', 'Bán lẻ', 'Thời trang', 'Giáo dục', 'Dịch vụ khác']

/** C-01: 2 bước — doanh nghiệp → kênh liên hệ. Lỗi lưu giữ nguyên dữ liệu form. */
export default function Onboarding() {
  const me = useMine()
  const { saveProfile, syncApp } = useStore()
  const [step, setStep] = useState(0)
  const [f, setF] = useState<Partial<Customer>>({ name: me.customer.name, contact: me.customer.contact, industry: me.customer.industry || INDUSTRIES[0], taxId: me.customer.taxId, phone: me.customer.phone, channel: me.customer.channel })
  const [err, setErr] = useState('')
  const [saving, startSaving] = useTransition()
  const set = (k: keyof Customer) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setF({ ...f, [k]: e.target.value }); setErr('') }
  const next = () => {
    if (step === 0) { if (!f.name?.trim() || !f.contact?.trim()) return setErr('Cho em xin tên doanh nghiệp và tên người liên hệ nhé.'); if (f.taxId && !/^\d{10}(-\d{3})?$/.test(f.taxId)) return setErr('Mã số thuế gồm 10 số (hoặc 10 số kèm -xxx).'); setStep(1); return }
    if (f.channel !== 'email' && !/^0\d{9}$/.test(f.phone ?? '')) return setErr('Số điện thoại gồm 10 số, bắt đầu bằng 0.')
    startSaving(async () => {
      const result = await updateAppProfile({
        businessName: f.name ?? '', contact: f.contact ?? '', phone: f.phone,
        industry: f.industry, taxId: f.taxId, channel: f.channel,
      })
      if (!result.ok) { setErr(result.error); return }
      saveProfile(f)
      await syncApp()
      navigate('/app')
    })
  }
  const field = 'h-10 max-md:h-11 px-3 border border-line rounded-r text-sm outline-none focus:border-accent w-full bg-white'

  return (
    <div className="min-h-[calc(100dvh-53px)] grid place-items-center px-4 py-10">
      <div className="w-full max-w-[440px] grid gap-6">
        <div className="flex gap-1.5" aria-label={`Bước ${step + 1}/2`}>{[0, 1].map((i) => <span key={i} className={`h-1 flex-1 rounded-sm ${i <= step ? 'bg-accent' : 'bg-hover'}`} />)}</div>
        <div className="grid gap-1"><p className="text-xs text-ink-3 font-mono">Bước {step + 1}/2</p><h1 className="text-xl">{step === 0 ? 'Doanh nghiệp của chị' : 'Studio liên hệ chị qua đâu?'}</h1><p className="text-[13px] text-ink-3">{step === 0 ? 'Đội thiết kế dùng thông tin này để làm đúng thương hiệu ngay từ bản đầu.' : 'Thông báo tiến độ và bản nháp sẽ gửi qua kênh này.'}</p></div>
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); next() }}>
          {step === 0 ? (
            <>
              <label className="grid gap-1.5"><span className="text-[13px] font-medium">Tên doanh nghiệp / thương hiệu</span><input autoFocus value={f.name ?? ''} onChange={set('name')} placeholder="Quán Mộc An" className={field} /></label>
              <label className="grid gap-1.5"><span className="text-[13px] font-medium">Người liên hệ</span><input value={f.contact ?? ''} onChange={set('contact')} placeholder="Ngọc Hân" className={field} /></label>
              <label className="grid gap-1.5"><span className="text-[13px] font-medium">Ngành</span><select value={f.industry} onChange={set('industry')} className={field}>{INDUSTRIES.map((i) => <option key={i}>{i}</option>)}</select></label>
              <label className="grid gap-1.5"><span className="text-[13px] font-medium">Mã số thuế <span className="text-ink-3 font-normal">(tùy chọn, để xuất hóa đơn)</span></span><input value={f.taxId ?? ''} onChange={set('taxId')} inputMode="numeric" placeholder="0312345678" className={field} /></label>
            </>
          ) : (
            <>
              <fieldset className="grid gap-2">
                {([['zalo', 'Zalo', 'Nhanh nhất, nhận ảnh bản nháp trực tiếp'], ['phone', 'Điện thoại / SMS', 'Chỉ gọi khi cần xác nhận gấp'], ['email', 'Email', 'Phù hợp nếu cần lưu chứng từ']] as const).map(([v, l, d]) => (
                  <label key={v} className={`flex gap-3 items-start border rounded-r2 p-3 cursor-pointer ${f.channel === v ? 'border-accent' : 'border-line hover:bg-side'}`}><input type="radio" name="ch" checked={f.channel === v} onChange={() => setF({ ...f, channel: v })} className="mt-1 accent-accent" /><span><span className="block text-sm font-medium">{l}</span><span className="block text-xs text-ink-3">{d}</span></span></label>
                ))}
              </fieldset>
              {f.channel !== 'email' && <label className="grid gap-1.5"><span className="text-[13px] font-medium">Số điện thoại{f.channel === 'zalo' && ' Zalo'}</span><input autoFocus value={f.phone ?? ''} onChange={set('phone')} inputMode="tel" placeholder="0901234567" className={field} /></label>}
            </>
          )}
          {err && <p role="alert" className="text-[13px] text-red-600">{err}</p>}
          <div className="flex gap-2">
            {step === 1 && <Btn size="l" onClick={() => setStep(0)}><Icon name="back" size={14} /> Quay lại</Btn>}
            <Btn type="submit" kind="primary" size="l" className="flex-1" disabled={saving}>{saving ? 'Đang lưu…' : step === 0 ? 'Tiếp tục' : 'Hoàn tất'}</Btn>
          </div>
          <button type="button" onClick={() => { saveProfile({}); navigate('/app') }} className="text-[13px] text-ink-3 hover:text-ink justify-self-center min-h-9">Bỏ qua, điền sau</button>
        </form>
      </div>
    </div>
  )
}
