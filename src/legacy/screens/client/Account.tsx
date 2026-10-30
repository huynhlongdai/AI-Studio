import { useState, useTransition } from 'react'
import { navigate } from '../../router'
import { useMine, useStore, type Customer } from '../../store'
import { Btn, Icon, Page, PageHead } from '../../ui'
import { logoutAppUser, updateAppProfile } from '@/app/(frontend)/actions/appAuth'

export default function Account() {
  const me = useMine()
  const { db, saveProfile, logout, syncApp } = useStore()
  const [f, setF] = useState<Partial<Customer>>(me.customer)
  const [saved, setSaved] = useState(false)
  const [req, setReq] = useState('')
  const [prefs, setPrefs] = useState({ draft: true, pay: true, marketing: false })
  const [error, setError] = useState('')
  const [saving, startSaving] = useTransition()
  const field = 'h-9 max-md:h-11 px-3 border border-line rounded-r text-sm outline-none focus:border-accent w-full'
  const set = (k: keyof Customer) => (e: React.ChangeEvent<HTMLInputElement>) => { setF({ ...f, [k]: e.target.value }); setSaved(false) }
  return (
    <Page max={760}>
      <PageHead title="Tài khoản" sub={db.session.client.email} />
      <form className="grid gap-4 border border-line rounded-r2 p-5" onSubmit={(e) => {
        e.preventDefault()
        startSaving(async () => {
          setError('')
          const result = await updateAppProfile({
            businessName: f.name ?? '', contact: f.contact ?? '', phone: f.phone, industry: f.industry,
            taxId: f.taxId, channel: f.channel, notifications: { draft: prefs.draft, payment: prefs.pay, marketing: prefs.marketing },
          })
          if (!result.ok) { setError(result.error); return }
          saveProfile(f)
          await syncApp()
          setSaved(true)
        })
      }}>
        <h2 className="text-sm">Hồ sơ doanh nghiệp</h2>
        <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-3">
          {([['name', 'Tên doanh nghiệp'], ['contact', 'Người liên hệ'], ['phone', 'Số điện thoại'], ['taxId', 'Mã số thuế']] as const).map(([k, l]) => (
            <label key={k} className="grid gap-1.5"><span className="text-[13px] text-ink-2">{l}</span><input value={(f[k] as string) ?? ''} onChange={set(k)} className={field} /></label>
          ))}
        </div>
        {error && <p role="alert" className="text-[13px] text-warn bg-warn/10 rounded-r px-3 py-2">{error}</p>}
        <div className="flex items-center gap-3"><Btn type="submit" kind="primary" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu thay đổi'}</Btn>{saved && <span role="status" className="text-[13px] text-ok inline-flex items-center gap-1"><Icon name="check" size={14} /> Đã lưu</span>}</div>
      </form>
      <section className="grid gap-2 border border-line rounded-r2 p-5">
        <h2 className="text-sm mb-1">Thông báo</h2>
        {([['draft', 'Có bản nháp mới chờ duyệt'], ['pay', 'Thanh toán và hóa đơn'], ['marketing', 'Ưu đãi và tin tức studio']] as const).map(([k, l]) => (
          <label key={k} className="flex items-center gap-3 min-h-10 text-[13px] cursor-pointer">
            <span className="flex-1">{l}</span>
            <button type="button" role="switch" aria-checked={prefs[k]} onClick={() => setPrefs({ ...prefs, [k]: !prefs[k] })} className={`w-9 h-5 rounded-full relative transition-colors ${prefs[k] ? 'bg-accent' : 'bg-[#d4d4d4]'}`}><span className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${prefs[k] ? 'left-[18px]' : 'left-0.5'}`} /></button>
          </label>
        ))}
      </section>
      <section className="grid gap-3 border border-line rounded-r2 p-5">
        <h2 className="text-sm">Dữ liệu & quyền riêng tư</h2>
        <p className="text-[13px] text-ink-3">Chị có thể yêu cầu xuất hoặc xóa toàn bộ dữ liệu theo Nghị định 13/2023. Studio xử lý trong 72 giờ.</p>
        {req && <p role="status" className="text-[13px] text-ok">{req}</p>}
        <div className="flex gap-2 flex-wrap"><Btn onClick={() => setReq('Đã ghi nhận yêu cầu xuất dữ liệu — studio gửi tệp qua email trong 72 giờ.')}>Xuất dữ liệu</Btn><Btn onClick={() => setReq('Đã ghi nhận yêu cầu xóa tài khoản — chuyên viên sẽ liên hệ xác nhận.')}>Yêu cầu xóa tài khoản</Btn><Btn kind="plain" className="ml-auto" onClick={async () => { await logoutAppUser(); logout(); navigate('/dang-nhap') }}>Đăng xuất</Btn></div>
      </section>
    </Page>
  )
}
