import { useState, useTransition } from 'react'
import { loginAppUser, registerAppUser } from '@/app/(frontend)/actions/appAuth'
import { navigate } from '../router'
import { useStore } from '../store'
import { Btn, Icon } from '../ui'

export default function Login({ admin = false }: { admin?: boolean }) {
  const { login, adminLogin, syncApp } = useStore()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState(admin ? 'longca@aistudio.vn' : '')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [err, setErr] = useState('')
  const [pending, startTransition] = useTransition()

  const submit = () => {
    setErr('')
    startTransition(async () => {
      const result = mode === 'register' && !admin
        ? await registerAppUser({ email, password, name, businessName })
        : await loginAppUser({ email, password, staff: admin })
      if (!result.ok) { setErr(result.error); return }
      if (admin) {
        adminLogin(result.role === 'customer' ? 'specialist' : result.role)
        await syncApp()
        navigate('/admin')
      } else {
        login(result.email)
        await syncApp()
        navigate('/app')
      }
    })
  }
  const field = 'h-11 px-3 border border-line rounded-r text-sm outline-none focus:border-accent w-full'
  return (
    <main className="min-h-dvh grid lg:grid-cols-[1.05fr_.95fr] bg-white">
      <section className="hidden lg:flex bg-ink text-white p-12 flex-col justify-between">
        <a href="#/" className="inline-flex items-center gap-2.5 text-sm font-medium"><span className="size-7 rounded-r bg-white text-ink grid place-items-center"><Icon name="spark" size={15} /></span>AI Studio</a>
        <div className="max-w-lg grid gap-4"><p className="text-xs text-white/50 font-mono">WORKSPACE SÁNG TẠO AI</p><h1 className="text-4xl leading-tight">Đặt việc, review trực quan và theo dõi đến từng bước.</h1><p className="text-sm text-white/60">Dữ liệu tài khoản được bảo vệ bằng phiên đăng nhập riêng, độc lập với hệ thống quản trị nội dung.</p></div>
        <p className="text-xs text-white/40">AI Studio · Payload secured application</p>
      </section>
      <section className="grid place-items-center p-6">
        <div className="w-full max-w-[420px] grid gap-6">
          <a href="#/" className="lg:hidden inline-flex items-center gap-2 text-sm font-medium"><span className="size-7 rounded-r bg-ink text-white grid place-items-center"><Icon name="spark" size={15} /></span>AI Studio</a>
          <div className="grid gap-1.5"><p className="text-xs text-ink-3">{admin ? 'Cổng studio' : mode === 'login' ? 'Chào mừng trở lại' : 'Bắt đầu cùng AI Studio'}</p><h1 className="text-2xl">{admin ? 'Đăng nhập nhân sự' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản khách hàng'}</h1></div>
          {!admin && (
            <div role="tablist" className="grid grid-cols-2 p-1 bg-soft rounded-r2">
              {(['login', 'register'] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={mode === item} onClick={() => { setMode(item); setErr('') }} className={`h-9 rounded-r text-[13px] ${mode === item ? 'bg-white shadow-sm font-medium' : 'text-ink-3'}`}>{item === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</button>)}
            </div>
          )}
          <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); submit() }}>
            {mode === 'register' && !admin && <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-3"><label className="grid gap-1.5"><span className="text-[13px] font-medium">Tên của bạn</span><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={field} /></label><label className="grid gap-1.5"><span className="text-[13px] font-medium">Doanh nghiệp</span><input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={field} /></label></div>}
            <label className="grid gap-1.5"><span className="text-[13px] font-medium">Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="ban@doanhnghiep.vn" className={field} /></label>
            <label className="grid gap-1.5"><span className="text-[13px] font-medium">Mật khẩu</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} placeholder="Tối thiểu 8 ký tự" className={field} /></label>
            {err && <p role="alert" className="text-[13px] text-warn bg-warn/10 rounded-r px-3 py-2">{err}</p>}
            <Btn type="submit" kind="primary" size="l" disabled={pending || !email || password.length < 8}>{pending ? 'Đang xử lý…' : mode === 'register' && !admin ? 'Tạo tài khoản' : 'Đăng nhập'}</Btn>
          </form>
          <p className="text-xs text-ink-3 text-center">Bằng việc tiếp tục, bạn đồng ý với điều khoản dịch vụ và chính sách quyền riêng tư.</p>
        </div>
      </section>
    </main>
  )
}
