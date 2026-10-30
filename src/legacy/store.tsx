import type React from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CATALOG, findPlan, findService, personas, QC_CHECKS, type PersonaId, type Service, type ServiceCode } from './lib/catalog'
import { emptyIntake, nextReply, type IntakeState } from './lib/intake'
import { price, type PriceResult } from './lib/pricing'
import { transition, type JobEvent, type JobState } from './lib/job-machine'
import { adapterFor } from './lib/runtime'
import { NEEDS_PLAN, proposePlan, runTest, salesReply, type AgentCfg, type AgentId, type Tier, TIERS, type ChannelId, type KItem, type Lead, type Plan, type PlanStep, type Runtime, type SalesAgent, type SalesTerms } from './lib/agents'
import { acceptManagedQuote, persistQuote, persistStaffQuote, rejectManagedQuote } from '@/app/(frontend)/actions/commerce'
import { markStaffConversationRead, persistConversationTurn, persistStaffMessage, updateStaffConversation, type StaffInboxSnapshot } from '@/app/(frontend)/actions/conversation'
import { getAppSnapshot, type AppSnapshot } from '@/app/(frontend)/actions/snapshot'
import { permissionsFor, ROLE_LABELS, type StaffPermission, type StaffRole } from '@/lib/staffPermissions'

/* ================= types ================= */
export type Actor = PersonaId | 'system' | 'owner' | 'client'
export interface Ev { id: string; t: number; actor: Actor; text: string; internal?: boolean; version?: number }
export type ReviewStatus = 'open' | 'in_progress' | 'fixed' | 'confirming' | 'resolved'
export type ReviewViewport = 'desktop' | 'tablet' | 'mobile'
export interface ReviewReply { id: string; t: number; from: 'client' | 'owner'; text: string }
export interface Annot {
  id: number; x: number; y: number; text: string
  kind?: 'pin' | 'region'; region?: { x: number; y: number; width: number; height: number }
  asset?: number; assetLabel?: string; viewport?: ReviewViewport; status?: ReviewStatus; replies?: ReviewReply[]
}
export interface Revision {
  version: number; annots: Annot[]; note: string; t: number
  capture?: string; captureAsset?: number; viewport?: ReviewViewport
}
export type OrderStatus = 'awaiting_deposit' | 'active' | 'awaiting_final' | 'completed' | 'canceled'
export interface Order {
  code: string; customer: string; quoteCode: string; service: ServiceCode; brand: string; style: string
  price: PriceResult; paid: number; status: OrderStatus; job: JobState; prevJob?: JobState
  progress: number; version: number; includedRevisions: number; revisionsUsed: number; extraRevisions: number; revisions: Revision[]
  rejectNote?: string; cancelReason?: string; createdAt: number; dueAt: number; lastStep: number; events: Ev[]; plan?: Plan
  /** Chi phí agent thực tế đã tiêu cho job (đ), phần nới trần, tầng model sau khi tự nâng. */
  agentCost?: number; capExtra?: number; capWarned?: boolean; capHit?: boolean; tier?: Tier
  reviewer?: string; input?: { q: string; a?: string; t: number }; offerId?: string
}
/** Agent xin phép trước hành động rủi ro (cấu hình ở Runtime & agent). */
export interface ActionReq { id: string; t: number; agent: AgentId; orderCode: string; customer: string; action: string; detail: string; version: number; status: 'pending' | 'approved' | 'denied'; by?: string; decidedAt?: number }
export type QuoteStatus = 'sent' | 'accepted' | 'expired' | 'rejected'
export interface Quote {
  code: string; customer: string; service: ServiceCode; brand: string; style: string; options: string[]; rush: boolean
  price: PriceResult; includedRevisions: number; status: QuoteStatus; createdAt: number; expiresAt: number; orderCode?: string; rejectReason?: string
}
export type PaymentKind = 'deposit' | 'final' | 'revision' | 'plan'
export interface Payment {
  id: string; customer: string; orderCode?: string; planCode?: string; kind: PaymentKind; method: 'qr' | 'credit'
  amount: number; ref: string; status: 'pending' | 'paid' | 'expired'; createdAt: number; expiresAt: number; paidAt?: number
}
export interface Msg { id: string; from: 'ai' | 'me' | 'owner'; text: string; t: number; quoteCode?: string; chips?: string[] }
export interface Thread { id: string; customer: string; messages: Msg[]; intake: IntakeState; handoff: boolean; takeover: boolean; unread: number; note: string }
export interface Notif { id: string; t: number; text: string; href: string; read: boolean; forAdmin?: boolean; customer?: string; provider?: string }
export interface Customer {
  id: string; name: string; contact: string; email: string; phone: string; industry: string; taxId: string
  channel: 'zalo' | 'email' | 'phone'; createdAt: number; plan?: { code: string; renewAt: number }; tags: string[]; note: string
}
export interface Ledger { id: string; t: number; customer: string; delta: number; text: string; orderCode?: string }
export interface PriceRow { code: ServiceCode; basePrice: number; rushSurcharge: number; includedRevisions: number; active: boolean; options: { code: string; label: string; price: number }[] }
export interface Settings {
  depositPct: number; smallOrder: number; extraRevision: number; qrTtlMin: number; quoteTtlH: number
  modelBudgetPct: number; gateway: 'payOS' | 'SePay'; bankName: string; bankAccount: string; accountName: string
  businessName: string; hours: string; aiEnabled: boolean; simSpeed: 1 | 2 | 4
}
export interface Member { id: string; name: string; email: string; role: StaffRole; permissions?: StaffPermission[]; active: boolean; skills: ServiceCode[]; maxQueue: number; createdAt: number }
export interface Session { client: { loggedIn: boolean; email: string; onboarded: boolean }; admin: boolean; staff: StaffRole; provider: string; member?: string; shop?: { customer: string; id: string } }
/** Việc studio đăng ra marketplace cho đối tác bên ngoài (phase 3, prototype). Brief đã ẩn thông tin cá nhân. */
export interface Offer {
  id: string; orderCode?: string; service: ServiceCode; title: string; brief: string; budget: number; dueAt: number
  status: 'open' | 'accepted' | 'delivered' | 'approved' | 'canceled'; provider?: string; createdAt: number; note?: string
  bids: { provider: string; note: string; days: number; t: number }[]; msgs: { from: 'studio' | 'provider'; text: string; t: number }[]
  delivery?: { link: string; note: string; t: number }; revisions: number; rating?: number; review?: string; payout?: { amount: number; status: 'pending' | 'paid'; paidAt?: number }
}
export interface Provider {
  id: string; name: string; contact: string; email: string; skills: ServiceCode[]; status: 'pending' | 'active' | 'suspended'
  share: number; bank: string; portfolio: string[]; bio: string; joinedAt: number
}
export interface DB {
  me: string; customers: Customer[]; quotes: Quote[]; orders: Order[]; payments: Payment[]; threads: Thread[]
  notifs: Notif[]; ledger: Ledger[]; catalog: PriceRow[]; settings: Settings; session: Session; seq: number
  runtimes: Runtime[]; agents: AgentCfg[]; sales: SalesAgent[]; audit: Audit[]; offers: Offer[]; providers: Provider[]; staff: Member[]; actions: ActionReq[]
}
export interface Audit { id: string; t: number; actor: 'admin' | 'client' | 'system'; scope: 'runtime' | 'agent' | 'plan' | 'sales'; text: string; customer?: string }

/* ================= constants & helpers ================= */
const KEY = 'ais-db-v3'
const STEP_MS = 2600
const HOUR = 3600_000, DAY = 24 * HOUR
const uid = () => Math.random().toString(36).slice(2, 10)
const GREETING = 'Chào chị, em là trợ lý AI của AI Studio. Em giúp chị lên brief, báo giá theo bảng giá và theo dõi đơn. Chị cần làm gì hôm nay ạ?'

export const defaultSettings = (): Settings => ({
  depositPct: 50, smallOrder: 500_000, extraRevision: 200_000, qrTtlMin: 15, quoteTtlH: 24, modelBudgetPct: 12,
  gateway: 'payOS', bankName: 'MB Bank · Ngân hàng Quân Đội', bankAccount: '0901 2345 6789', accountName: 'HKD AI STUDIO',
  businessName: 'HKD AI Studio', hours: '8:00–21:00', aiEnabled: true, simSpeed: 1,
})

/** Effective service = static copy (name, agent, deliverables) + admin-edited prices. */
export function serviceOf(db: DB, code: ServiceCode): Service {
  const base = findService(code)!, row = db.catalog.find((r) => r.code === code)
  return row ? { ...base, basePrice: row.basePrice, rushSurcharge: row.rushSurcharge, includedRevisions: row.includedRevisions, options: row.options } : base
}
export const activeServices = (db: DB) => db.catalog.filter((r) => r.active).map((r) => serviceOf(db, r.code))
export const creditOf = (db: DB, customer: string) => db.ledger.filter((l) => l.customer === customer).reduce((s, l) => s + l.delta, 0)
export const revisionsLeft = (o: Order) => o.includedRevisions + o.extraRevisions - o.revisionsUsed
export const isRevisionBlocked = (o: Order) => revisionsLeft(o) <= 0
export const customerName = (db: DB, id: string) => db.customers.find((c) => c.id === id)?.name || 'Khách mới'
export const canStaff = (db: Pick<DB, 'staff' | 'session'>, permission: StaffPermission) => {
  const member = db.staff.find((item) => item.id === db.session.member)
  return permissionsFor(member?.role ?? db.session.staff, member?.permissions).includes(permission)
}

/* client-facing mapping (spec §4.1) */
export const STEPS = ['Xếp hàng', 'Lên ý tưởng', 'Sản xuất', 'Kiểm tra chất lượng', 'Chuyên viên duyệt', 'Bạn duyệt', 'Hoàn tất']
export function stepIndex(o: Order): number {
  switch (o.job) {
    case 'queued': case 'offered': case 'assigned': return 0
    case 'running': case 'input_required': case 'stalled': case 'escalated': return o.progress < 35 ? 1 : 2
    case 'revision_requested': return 2
    case 'submitted': case 'qc_review': return 3
    case 'pending_approval': return 4
    case 'client_review': return 5
    case 'accepted': return o.status === 'awaiting_final' ? 5 : 6
    case 'completed': return 6
    default: return 0
  }
}
export type Tone = 'run' | 'done' | 'wait' | 'queue' | 'stop'
export function orderLabel(o: Order): { label: string; tone: Tone } {
  if (o.status === 'canceled') return { label: 'Đã hủy', tone: 'stop' }
  if (o.status === 'awaiting_deposit') return { label: 'Chờ thanh toán cọc', tone: 'wait' }
  if (o.status === 'awaiting_final') return { label: 'Chờ thanh toán phần còn lại', tone: 'wait' }
  if (o.job === 'on_hold') return { label: 'Tạm dừng', tone: 'queue' }
  if (o.job === 'client_review') return { label: 'Chờ bạn duyệt', tone: 'wait' }
  if (o.job === 'completed') return { label: 'Hoàn tất', tone: 'done' }
  if (o.job === 'accepted') return { label: 'Đang đóng gói tệp', tone: 'run' }
  if (['queued', 'offered', 'assigned'].includes(o.job)) return { label: 'Đang xếp hàng', tone: 'queue' }
  return { label: 'Đang thực hiện', tone: 'run' }
}
export function adminLabel(j: JobState): string {
  return ({ queued: 'Xếp hàng', offered: 'Đã offer', assigned: 'Đã nhận', running: 'Đang chạy', input_required: 'Cần input', submitted: 'Đã nộp', qc_review: 'Kiểm tra', pending_approval: 'Chờ duyệt', client_review: 'Khách duyệt', revision_requested: 'Yêu cầu sửa', accepted: 'Đã chấp nhận', completed: 'Hoàn tất', on_hold: 'Tạm dừng', stalled: 'Treo', escalated: 'Leo thang', canceled: 'Đã hủy', failed: 'Lỗi' } as Record<JobState, string>)[j]
}
export const orderStatusAdmin = (o: Order) => o.status === 'awaiting_deposit' ? 'Chờ cọc' : o.status === 'awaiting_final' ? 'Chờ thanh toán cuối' : o.status === 'canceled' ? 'Đã hủy' : adminLabel(o.job)

/* ================= builders ================= */
const codeOf = (prefix: string, n: number) => `${prefix}-2610-${String(n).padStart(3, '0')}`
const refOf = (code: string, kind: PaymentKind) => 'AIS' + code.replace(/\D/g, '') + { deposit: 'C', final: 'F', revision: 'R', plan: 'G' }[kind]
const ev = (t: number, actor: Actor, text: string, extra: Partial<Ev> = {}): Ev => ({ id: uid(), t, actor, text, ...extra })

function makeQuote(d: DB, customer: string, svc: ServiceCode, brand: string, style: string, options: string[], rush: boolean, now = Date.now()): Quote {
  const s = serviceOf(d, svc)
  const p = price({ service: s, optionCodes: options.filter((o) => s.options.some((x) => x.code === o)), rush, depositPct: d.settings.depositPct, smallOrderThreshold: d.settings.smallOrder })
  const q: Quote = { code: codeOf('BG', ++d.seq), customer, service: svc, brand, style, options, rush, price: p, includedRevisions: s.includedRevisions, status: 'sent', createdAt: now, expiresAt: now + d.settings.quoteTtlH * HOUR }
  d.quotes.unshift(q)
  return q
}
function makeOrder(d: DB, q: Quote, now = Date.now()): Order {
  const o: Order = {
    code: codeOf('AIS', ++d.seq), customer: q.customer, quoteCode: q.code, service: q.service, brand: q.brand, style: q.style, price: q.price, paid: 0,
    status: 'awaiting_deposit', job: 'queued', progress: 0, version: 0, includedRevisions: q.includedRevisions, revisionsUsed: 0, extraRevisions: 0, revisions: [],
    createdAt: now, dueAt: now + (q.rush ? DAY : findService(q.service)!.slaDays * DAY), lastStep: now, events: [],
  }
  q.status = 'accepted'; q.orderCode = o.code
  d.orders.unshift(o)
  return o
}
function makePayment(d: DB, customer: string, kind: PaymentKind, amount: number, target: { orderCode?: string; planCode?: string }, now = Date.now(), method: 'qr' | 'credit' = 'qr'): Payment {
  d.payments.forEach((p) => { if (p.status === 'pending' && p.kind === kind && p.orderCode === target.orderCode && p.planCode === target.planCode && p.customer === customer) p.status = 'expired' })
  const ref = refOf(target.orderCode ?? `${target.planCode}${d.seq}`, kind)
  const p: Payment = { id: uid(), customer, ...target, kind, method, amount, ref: ref.length > 16 ? 'AISG' + d.seq + Math.floor(Math.random() * 900 + 100) : ref, status: 'pending', createdAt: now, expiresAt: now + d.settings.qrTtlMin * 60_000 }
  d.payments.unshift(p)
  return p
}
function notify(d: DB, text: string, href: string, opt: { forAdmin?: boolean; customer?: string; provider?: string } = {}) {
  d.notifs.unshift({ id: uid(), t: Date.now(), text, href, read: false, ...opt })
}
/** Hành động rủi ro mà mỗi loại việc chạm tới khi gần xong. */
export const RISK_BY_SERVICE: Partial<Record<ServiceCode, string>> = { post: 'Đăng bài lên kênh của khách', landing: 'Đăng bài lên kênh của khách', video: 'Gửi tin nhắn ra ngoài nền tảng' }
const TIER_MUL: Record<Tier, number> = { fast: 0.6, standard: 1, pro: 2.2 }
const NEXT_TIER: Record<Tier, Tier> = { fast: 'standard', standard: 'pro', pro: 'pro' }
export const jobCap = (d: DB, o: Order) => { const svc = findService(o.service); const a = d.agents.find((x) => x.id === svc?.agent); return (a?.capJob ?? 0) + (o.capExtra ?? 0) }
/** Chọn chuyên viên duyệt: đúng kỹ năng, còn chỗ, ít việc nhất; hết người thì về admin. */
export function pickReviewer(d: DB, service: ServiceCode): string {
  const load = (id: string) => d.orders.filter((o) => o.reviewer === id && (o.job === 'pending_approval' || o.plan?.status === 'pending')).length
  const pool = d.staff.filter((m) => m.active && (m.role === 'specialist' || m.role === 'manager') && m.skills.includes(service) && load(m.id) < m.maxQueue).sort((a, b) => load(a.id) - load(b.id))
  return pool[0]?.id ?? d.staff.find((m) => m.role === 'admin' && m.active)?.id ?? 'longca'
}
/** Chia lead cho nhân viên shop đang hoạt động có ít lead mới nhất. */
function assignLead(a: SalesAgent): string | undefined {
  const team = (a.team ?? []).filter((m) => m.active)
  if (!team.length) return undefined
  const load = (id: string) => a.leads.filter((l) => l.assignee === id && l.status === 'new').length
  return team.sort((x, y) => load(x.id) - load(y.id))[0].id
}
function addLead(d: DB, a: SalesAgent, lead: Omit<Lead, 'id' | 't' | 'status' | 'assignee'>): Lead | null {
  if (a.leads.some((l) => l.phone === lead.phone && Date.now() - l.t < DAY)) return null
  const l: Lead = { ...lead, id: uid(), t: Date.now(), status: 'new', assignee: assignLead(a) }
  a.leads.unshift(l)
  const who = a.team?.find((m) => m.id === l.assignee)
  notify(d, `Lead mới${who ? ` giao ${who.name}` : ''}: ${l.name} · ${l.need.slice(0, 40)}`, '#/app/agent/lead', { customer: a.customer })
  return l
}
function audit(d: DB, actor: Audit['actor'], scope: Audit['scope'], text: string, customer?: string) {
  d.audit.unshift({ id: uid(), t: Date.now(), actor, scope, text, customer })
  if (d.audit.length > 300) d.audit.length = 300
}
const move = (o: Order, e: JobEvent) => { o.job = transition(o.job, e) }
const vndS = (n: number) => n.toLocaleString('vi-VN') + 'đ'

/** Applies money received to the right object. Shared by QR webhook simulation and credit spend. */
function applyPaid(d: DB, p: Payment, now: number) {
  p.status = 'paid'; p.paidAt = now
  if (p.kind === 'plan') {
    const plan = findPlan(p.planCode!)!
    const c = d.customers.find((x) => x.id === p.customer)!
    c.plan = { code: plan.code, renewAt: now + 30 * DAY }
    d.ledger.unshift({ id: uid(), t: now, customer: c.id, delta: plan.credit, text: `Nạp credit gói ${plan.name}` })
    notify(d, `Đã kích hoạt gói ${plan.name} · +${vndS(plan.credit)} credit`, '#/app/goi', { customer: c.id })
    notify(d, `${c.name} mua gói ${plan.name}`, '#/admin/khach-hang/' + c.id, { forAdmin: true })
    return
  }
  const o = d.orders.find((x) => x.code === p.orderCode)!
  const amt = vndS(p.amount), via = p.method === 'credit' ? ' bằng credit' : ''
  if (p.kind !== 'revision') o.paid += p.amount
  if (p.kind === 'deposit') {
    if (o.paid >= o.price.depositAmount) {
      o.status = 'active'; o.lastStep = now
      o.events.push(ev(now, 'system', `Đã nhận cọc ${vndS(o.paid)}${via} — đơn vào hàng chờ`))
      notify(d, `Đã nhận cọc cho ${o.code}`, `#/app/don-hang/${o.code}`, { customer: o.customer })
      notify(d, `Đơn mới ${o.code} · ${findService(o.service)!.name} · ${customerName(d, o.customer)}`, `#/admin/viec/${o.code}`, { forAdmin: true })
    } else o.events.push(ev(now, 'system', `Đã trừ ${amt} credit vào tiền cọc`))
  } else if (p.kind === 'final') {
    o.status = 'active'; o.lastStep = now - STEP_MS
    o.events.push(ev(now, 'system', `Đã nhận phần còn lại ${amt}${via}`))
  } else {
    o.extraRevisions++
    o.events.push(ev(now, 'system', `Đã mua thêm 1 lượt sửa (${amt})`))
  }
}

/* ================= simulation (stands in for worker + QC agents) ================= */
const SCRIPT: Record<ServiceCode, string[]> = {
  logo: ['Lên moodboard và 3 hướng ý tưởng', 'Phác thảo biểu tượng, thử 4 kiểu chữ', 'Vector hóa và cân chỉnh khoảng cách chữ', 'Xuất bản đen trắng và biểu tượng 1:1'],
  post: ['Chọn bố cục lưới cho 6 post', 'Dựng post 1–3 trên Canva', 'Dựng post 4–6, viết caption gợi ý', 'Rà soát vùng an toàn và màu'],
  video: ['Viết kịch bản 4 cảnh', 'Tạo cảnh 1–2 bằng Seedance', 'Tạo cảnh 3–4, ghép nhịp', 'Thêm phụ đề và nhạc nền'],
  landing: ['Dựng sơ đồ nội dung trang', 'Thiết kế giao diện điện thoại trước', 'Dựng trang trên Flatsome', 'Gắn form và kiểm tra tốc độ'],
}

export function tick(d: DB, now: number): boolean {
  let changed = false
  const step = STEP_MS / (d.settings?.simSpeed ?? 1)
  for (const p of d.payments) if (p.status === 'pending' && p.expiresAt < now) { p.status = 'expired'; changed = true }
  for (const q of d.quotes) if (q.status === 'sent' && q.expiresAt < now) { q.status = 'expired'; changed = true }
  for (const o of d.orders) {
    if (now - o.lastStep < step) continue
    const svc = findService(o.service)!, p = personas[svc.agent]
    const sig = o.job + o.progress + o.events.length + o.status + (o.plan?.status ?? '')
    // Cổng kế hoạch: agent điều phối lập kế hoạch, chuyên viên duyệt rồi mới giao việc.
    if (o.status === 'active' && o.job === 'queued' && NEEDS_PLAN.includes(o.service) && o.plan?.status !== 'approved') {
      if (!o.plan) {
        o.plan = { status: 'pending', steps: proposePlan(o.service, o.style, uid), createdAt: now }
        o.reviewer = pickReviewer(d, o.service)
        o.events.push(ev(now, 'system', `Agent điều phối lập kế hoạch ${o.plan.steps.length} bước — chờ chuyên viên duyệt`))
        notify(d, `${o.code}: kế hoạch chờ duyệt`, `#/admin/duyet/${o.code}`, { forAdmin: true })
        o.lastStep = now; changed = true
      }
      continue
    }
    // Kill switch / quyền: agent tắt, runtime tạm dừng hoặc vượt trần chi phí ngày → không chạy tiếp.
    const worker = ['submitted', 'qc_review'].includes(o.job) ? 'lan' : svc.agent
    const cfg = d.agents?.find((a) => a.id === worker), rt = cfg && d.runtimes.find((r) => r.id === cfg.runtime)
    if (o.status === 'active' && cfg && rt && (!cfg.enabled || rt.status !== 'connected' || cfg.spentToday >= cfg.capDay)) continue
    if (cfg && o.status === 'active' && o.job === 'running') {
      const cap = jobCap(d, o)
      if ((o.agentCost ?? 0) >= cap) {
        if (!o.capHit) { o.capHit = true; o.events.push(ev(now, 'system', `Chạm trần chi phí job ${vndS(cap)} — giữ việc, chờ chuyên viên`, { internal: true })); notify(d, `${o.code} chạm trần chi phí agent`, `#/admin/viec/${o.code}`, { forAdmin: true }); changed = true }
        continue
      }
      // Hành động rủi ro: agent dừng lại xin phép trước khi làm.
      const act = RISK_BY_SERVICE[o.service]
      if (act && cfg.approval.includes(act) && o.progress >= 60) {
        const r = d.actions.find((x) => x.orderCode === o.code && x.action === act && x.version === o.version + 1)
        if (!r) {
          d.actions.unshift({ id: uid(), t: now, agent: cfg.id, orderCode: o.code, customer: o.customer, action: act, detail: o.service === 'landing' ? `Đưa landing ${o.brand} lên tên miền thử nghiệm` : o.service === 'post' ? `Lên lịch ${o.brand} trên Fanpage của khách` : `Gửi bản xem trước video qua Zalo cho khách`, version: o.version + 1, status: 'pending' })
          o.events.push(ev(now, cfg.id as Actor, `Xin phép chuyên viên: ${act.toLowerCase()}`))
          notify(d, `${cfg.name} xin phép: ${act} (${o.code})`, '#/admin/duyet', { forAdmin: true })
          o.lastStep = now; changed = true; continue
        }
        if (r.status === 'pending') continue
      }
      // Thiếu thông tin brief: agent hỏi lại khách thay vì đoán.
      if (!o.input && o.progress >= 25 && o.style.trim().length < 6) {
        move(o, 'needs_input'); o.input = { q: `Em cần thêm thông tin để làm đúng ý: chị mô tả phong cách mong muốn (màu, cảm giác, thương hiệu tham khảo) cho ${o.brand} giúp em nhé?`, t: now }
        o.events.push(ev(now, svc.agent, 'Cần thêm thông tin từ khách — đã gửi câu hỏi'))
        notify(d, `${o.brand}: agent cần thêm thông tin`, `#/app/don-hang/${o.code}`, { customer: o.customer })
        o.lastStep = now; changed = true; continue
      }
      // Chỉ tính phí khi agent thực sự chạy bước (không tính lúc chờ duyệt / chờ khách).
      const c = Math.round(o.price.total * 0.012 * TIER_MUL[o.tier ?? cfg.tier])
      cfg.spentToday += c; o.agentCost = (o.agentCost ?? 0) + c
      if (!o.capWarned && o.agentCost >= cap * 0.8) { o.capWarned = true; o.events.push(ev(now, 'system', `Đã dùng 80% trần chi phí job (${vndS(o.agentCost)} / ${vndS(cap)})`, { internal: true })); notify(d, `${o.code} dùng 80% trần chi phí`, `#/admin/viec/${o.code}`, { forAdmin: true }) }
    }
    if (o.status === 'active') {
      switch (o.job) {
        case 'queued': move(o, 'dispatch'); o.events.push(ev(now, 'system', `Gửi offer cho ${p.name} (OpenClaw nội bộ)`, { internal: true })); break
        case 'offered': move(o, 'accept'); o.events.push(ev(now, svc.agent, `${p.name} nhận việc`)); break
        case 'assigned': move(o, 'start'); o.progress = 6; o.events.push(ev(now, svc.agent, 'Bắt đầu đọc brief và lên ý tưởng')); break
        case 'revision_requested': {
          move(o, 'start'); o.progress = 45
          const r = o.revisions[o.revisions.length - 1]
          o.events.push(ev(now, svc.agent, `Bắt đầu sửa theo ${r ? r.annots.length + (r.note ? 1 : 0) : 0} góp ý của bạn`))
          break
        }
        case 'running': {
          const prev = o.progress
          o.progress = Math.min(100, o.progress + 19)
          if (o.progress < 100 && Math.floor(o.progress / 25) > Math.floor(prev / 25)) o.events.push(ev(now, svc.agent, SCRIPT[o.service][Math.min(3, Math.floor(o.progress / 25))]))
          if (o.progress >= 100) { move(o, 'submit'); o.version++; o.events.push(ev(now, svc.agent, `Hoàn thành bản nháp v${o.version}, gửi kiểm tra chất lượng`)) }
          break
        }
        case 'submitted': move(o, 'qc_enqueue'); o.events.push(ev(now, 'lan', `Bắt đầu kiểm tra bản v${o.version}`)); break
        case 'qc_review': {
          move(o, 'qc_pass')
          const n = QC_CHECKS[o.service].length
          o.events.push(ev(now, 'lan', `Kiểm tra chất lượng v${o.version}: đạt ${n}/${n} tiêu chí`))
          o.reviewer = pickReviewer(d, o.service)
          o.events.push(ev(now, 'system', `Chờ chuyên viên ${d.staff.find((m) => m.id === o.reviewer)?.name ?? ''} duyệt trước khi gửi khách`, { internal: true }))
          notify(d, `${o.code} · bản v${o.version} chờ duyệt`, `#/admin/duyet/${o.code}`, { forAdmin: true })
          break
        }
      }
    }
    if (o.job === 'accepted' && o.paid >= o.price.total && o.status !== 'completed') {
      move(o, 'final_packaged'); o.status = 'completed'; o.progress = 100
      o.events.push(ev(now, 'system', 'Đã đóng gói tệp gốc — sẵn sàng tải về'))
      notify(d, `${o.brand}: tệp gốc đã sẵn sàng tải`, `#/app/don-hang/${o.code}/tep`, { customer: o.customer })
    }
    if (sig !== o.job + o.progress + o.events.length + o.status + (o.plan?.status ?? '')) { o.lastStep = now; changed = true }
  }
  // Agent bán hàng đang chạy: mô phỏng hội thoại và lead đến từ kênh đã kết nối.
  for (const a of d.sales ?? []) {
    const live = a.channels.filter((c) => c.connected)
    if (a.status !== 'live' || !live.length || now - a.lastSim < 45_000 / (d.settings.simSpeed ?? 1)) continue
    a.lastSim = now
    const ch = live[Math.floor(Math.random() * live.length)]
    const n = 2 + Math.floor(Math.random() * 4)
    a.conv += n; ch.conv += n
    if (Math.random() < 0.5) {
      const pools = poolFor(a.customer)
      const pool = pools[Math.floor(Math.random() * pools.length)]
      const prod = a.knowledge.find((k) => k.kind === 'product' && k.status === 'approved')
      addLead(d, a, { channel: ch.id, note: '', ...pool, product: prod?.title ?? pool.product, phone: '09' + Math.floor(10000000 + Math.random() * 89999999), consentAt: now })
    }
    changed = true
  }
  return changed
}

const SIM_LEADS: Omit<Lead, 'id' | 't' | 'status' | 'channel' | 'note' | 'phone'>[] = [
  { name: 'Chị Lan', need: 'Đặt 30 ly cho buổi họp công ty thứ 6', product: '', budget: '1,5 triệu', heat: 'hot', summary: 'Hỏi giá sỉ, giao tận nơi quận 3, cần xuất hóa đơn VAT.', next: 'Gọi xác nhận số lượng và giờ giao' },
  { name: 'Anh Khôi', need: 'Hỏi chỗ ngồi làm việc buổi tối', product: '', budget: 'Chưa rõ', heat: 'warm', summary: 'Hỏi wifi, ổ cắm, giờ đóng cửa. Muốn đặt bàn 4 người.', next: 'Nhắn Zalo gửi ảnh không gian và giữ bàn' },
  { name: 'Bạn Vy', need: 'Tổ chức sinh nhật nhỏ 10 người', product: '', budget: '2 triệu', heat: 'hot', summary: 'Hỏi phòng riêng, bánh kem tự mang, trang trí.', next: 'Gọi tư vấn gói tiệc và cọc giữ chỗ' },
  { name: 'Chị Hương', need: 'Mua quà tặng hạt cà phê', product: '', budget: '500k', heat: 'cold', summary: 'Hỏi loại hạt rang vừa, đóng hộp quà.', next: 'Gửi bảng giá hộp quà' },
]

const SIM_LEADS_BOOK: typeof SIM_LEADS = [
  { name: 'Chị Ngọc', need: 'Mua bộ sách thiếu nhi làm quà cho lớp mẫu giáo', product: '', budget: '3 triệu', heat: 'hot', summary: 'Cần 25 cuốn, xuất hóa đơn cho trường, giao trước thứ 2.', next: 'Gọi gửi danh mục và báo giá sỉ' },
  { name: 'Anh Tuấn', need: 'Tìm sách kỹ năng cho nhân viên mới', product: '', budget: '1 triệu', heat: 'warm', summary: 'Hỏi gợi ý 5 đầu sách quản lý thời gian, giao Hà Nội.', next: 'Nhắn Zalo danh sách gợi ý' },
  { name: 'Bạn Thảo', need: 'Hỏi thẻ thành viên', product: '', budget: 'Chưa rõ', heat: 'cold', summary: 'Hỏi ưu đãi thẻ thành viên và cách đăng ký online.', next: 'Gửi link đăng ký thẻ' },
]
const poolFor = (customer: string) => (customer === 'sach-gio' ? SIM_LEADS_BOOK : SIM_LEADS)

/* ================= seed ================= */
function newThread(customer: string, now = Date.now()): Thread {
  return { id: customer, customer, intake: emptyIntake(), handoff: false, takeover: false, unread: 0, note: '', messages: [{ id: uid(), from: 'ai', t: now, text: GREETING, chips: CATALOG.map((c) => c.short) }] }
}

export function seed(empty = false): DB {
  const now = Date.now()
  const d: DB = {
    me: 'moc-an', customers: [], quotes: [], orders: [], payments: [], threads: [], notifs: [], ledger: [],
    catalog: CATALOG.map((s) => ({ code: s.code, basePrice: s.basePrice, rushSurcharge: s.rushSurcharge, includedRevisions: s.includedRevisions, active: true, options: s.options.map((o) => ({ ...o })) })),
    settings: defaultSettings(), session: { client: { loggedIn: !empty, email: empty ? '' : 'han@mocan.vn', onboarded: !empty }, admin: false, staff: 'admin', provider: '', member: 'longca' }, seq: 10,
    offers: seedOffers(now), providers: seedProviders(now), staff: seedStaff(now), actions: [],
    runtimes: seedRuntimes(now), agents: seedAgents(), sales: [], audit: [
      { id: uid(), t: now - 3 * DAY, actor: 'admin', scope: 'runtime', text: 'Kết nối OpenClaw · prized.dev, đọc 7 tool' },
      { id: uid(), t: now - 2 * DAY, actor: 'admin', scope: 'agent', text: 'Minh: bật duyệt trước khi “Đăng bài lên kênh của khách”' },
    ],
  }
  const cust = (id: string, name: string, contact: string, industry: string, ageD: number, extra: Partial<Customer> = {}) => {
    d.customers.push({ id, name, contact, industry, email: `${contact.split(' ').pop()!.toLowerCase()}@${id.replace('-', '')}.vn`, phone: '09' + String(10000000 + ageD * 7919).slice(0, 8), taxId: '', channel: 'zalo', createdAt: now - ageD * DAY, tags: [], note: '', ...extra })
    d.threads.push(newThread(id, now - ageD * DAY))
  }
  cust('moc-an', empty ? '' : 'Quán Mộc An', empty ? '' : 'Ngọc Hân', empty ? '' : 'Cà phê · F&B', 40, empty ? { email: '', phone: '' } : { email: 'han@mocan.vn', tags: ['Khách quen'] })
  cust('banh-may', 'Tiệm bánh Mây', 'Thu Trang', 'Bánh ngọt', 18)
  cust('ha-an', 'Spa Hạ An', 'Minh Thư', 'Làm đẹp', 9, { channel: 'phone' })
  cust('sach-gio', 'Nhà sách Gió', 'Quốc Bảo', 'Bán lẻ', 60, { tags: ['Gói tháng'], plan: { code: 'tang-truong', renewAt: now + 12 * DAY } })
  cust('anh-lam', 'Studio ảnh Lam', 'Hoàng Lam', 'Nhiếp ảnh', 25)
  d.ledger.push({ id: uid(), t: now - 18 * DAY, customer: 'sach-gio', delta: 3_400_000, text: 'Nạp credit gói Tăng trưởng' })

  /** Fabricates an order already at `job`, with plausible history and payments. */
  const mk = (customer: string, svc: ServiceCode, brand: string, style: string, opts: string[], ageH: number, job: JobState, extra: Partial<Order> = {}) => {
    const t0 = now - ageH * HOUR
    const q = makeQuote(d, customer, svc, brand, style, opts, false, t0)
    const o = makeOrder(d, q, t0 + 10 * 60_000)
    const dep = makePayment(d, customer, 'deposit', q.price.depositAmount, { orderCode: o.code }, t0 + 15 * 60_000)
    dep.status = 'paid'; dep.paidAt = t0 + 18 * 60_000; o.paid = dep.amount; o.status = 'active'
    const a = findService(svc)!.agent
    o.events.push(ev(dep.paidAt, 'client', `Bạn đã chấp nhận báo giá ${q.code}`), ev(dep.paidAt, 'system', `Đã nhận cọc ${vndS(dep.amount)} — đơn vào hàng chờ`), ev(dep.paidAt + 5 * 60_000, a, `${personas[a].name} nhận việc`))
    const done = ['completed', 'accepted'].includes(job), drafted = done || ['client_review', 'pending_approval', 'qc_review'].includes(job)
    Object.assign(o, { job, progress: drafted ? 100 : 44, version: drafted ? 1 : 0, lastStep: now + 3000 }, extra)
    if (drafted) o.events.push(ev(t0 + (ageH * HOUR) * 0.5, a, `Hoàn thành bản nháp v1, gửi kiểm tra chất lượng`), ev(t0 + (ageH * HOUR) * 0.55, 'lan', `Kiểm tra chất lượng v1: đạt ${QC_CHECKS[svc].length}/${QC_CHECKS[svc].length} tiêu chí`))
    if (job === 'client_review' || done) o.events.push(ev(t0 + (ageH * HOUR) * 0.6, 'owner', 'Chuyên viên đã duyệt bản v1 và gửi bạn', { version: 1 }))
    if (job === 'running') o.events.push(ev(now - 2 * HOUR, a, SCRIPT[svc][1]))
    if (done) {
      const f = makePayment(d, customer, 'final', o.price.total - o.paid, { orderCode: o.code }, t0 + (ageH * HOUR) * 0.8)
      f.status = 'paid'; f.paidAt = f.createdAt + 90_000; o.paid = o.price.total; o.status = 'completed'
      o.events.push(ev(f.paidAt, 'client', 'Bạn đã duyệt bản v1'), ev(f.paidAt + 60_000, 'system', 'Đã đóng gói tệp gốc — sẵn sàng tải về'))
    }
    return o
  }

  // Historical completed work across customers (feeds finance charts)
  const hist: [string, ServiceCode, string, number][] = [
    ['sach-gio', 'post', 'Nhà sách Gió', 330], ['anh-lam', 'logo', 'Studio ảnh Lam', 300], ['sach-gio', 'video', 'Nhà sách Gió', 260],
    ['banh-may', 'post', 'Tiệm bánh Mây', 210], ['sach-gio', 'landing', 'Nhà sách Gió', 170], ['anh-lam', 'post', 'Studio ảnh Lam', 130], ['sach-gio', 'post', 'Nhà sách Gió', 74],
  ]
  for (const [c, s, b, age] of hist) mk(c, s, b, 'Theo bộ nhận diện sẵn có', [], age, 'completed')

  mk('banh-may', 'logo', 'Tiệm bánh Mây', 'Dễ thương, màu kem và hồng đất', ['mini'], 6, 'pending_approval')
  mk('ha-an', 'landing', 'Spa Hạ An', 'Trang đặt lịch, tông xanh ngọc nhẹ', ['form'], 26, 'running', { progress: 38 })
  mk('anh-lam', 'video', 'Studio ảnh Lam', 'Giới thiệu gói chụp cưới, chậm rãi, sang', ['music'], 30, 'client_review')

  // Customer threads with real conversations
  const th = (id: string) => d.threads.find((t) => t.id === id)!
  th('ha-an').messages.push(
    { id: uid(), from: 'me', t: now - 50 * 60_000, text: 'Cho mình hỏi trang có tích hợp được lịch Google để khách tự chọn giờ không?' },
    { id: uid(), from: 'ai', t: now - 49 * 60_000, text: 'Dạ câu này em chuyển chuyên viên để trả lời chính xác ạ. Em đã chuyển cuộc trò chuyện cho chuyên viên.' },
  )
  Object.assign(th('ha-an'), { handoff: true, unread: 1 })
  th('banh-may').messages.push({ id: uid(), from: 'me', t: now - 5 * HOUR, text: 'Logo có làm thêm bản cho hộp bánh được không em?' }, { id: uid(), from: 'ai', t: now - 5 * HOUR, text: 'Dạ được ạ, bộ nhận diện mini đã gồm mẫu áp lên bao bì. Em ghi chú để Mai làm thêm bản hộp bánh nhé.' })
  th('anh-lam').messages.push({ id: uid(), from: 'me', t: now - 3 * HOUR, text: 'Video bản 1 ổn, mình xem kỹ tối nay rồi duyệt nhé.' })
  notify(d, 'Spa Hạ An cần chuyên viên trả lời', '#/admin/hop-thu/ha-an', { forAdmin: true })

  d.sales.push(seedSales('sach-gio', 'Nhà sách Gió', 'live', now, 21), { ...seedSales('banh-may', 'Tiệm bánh Mây', 'setup', now, 2), terms: null, termsRequested: true, handoffTo: 'chị Mây', knowledge: [
    { id: uid(), kind: 'profile', title: 'Giới thiệu', body: 'Dạ Tiệm bánh Mây chuyên bánh kem và bánh mì ngọt, làm trong ngày ạ.', source: 'client', status: 'approved', comments: [], t: now - 2 * DAY },
    { id: uid(), kind: 'product', title: 'Bánh kem bắp', body: 'Dạ bánh kem bắp size 16cm giá 280.000đ, đặt trước 1 ngày ạ.', source: 'client', status: 'approved', comments: [], t: now - 2 * DAY },
    { id: uid(), kind: 'faq', title: 'Giờ mở cửa', body: 'Theo Google Maps, tiệm mở 6:30–21:00.', source: 'research', status: 'proposed', sourceUrl: 'Google Maps', comments: [], t: now - DAY },
  ] })
  // Kế hoạch đã duyệt cho landing đang chạy
  d.orders.filter((o) => o.service === 'landing' && o.status !== 'awaiting_deposit').forEach((o) => { o.plan = { status: 'approved', steps: proposePlan('landing', o.style, uid), createdAt: o.createdAt, approvedAt: o.createdAt + HOUR } })
  if (empty) { d.orders.sort((a, b) => b.createdAt - a.createdAt); return d }

  // ---- Quán Mộc An (the logged-in customer) ----
  const me = 'moc-an'
  mk(me, 'post', 'Mộc An', 'Khai trương, tông đất ấm', [], 120, 'completed')
  const o2 = mk(me, 'video', 'Mộc An', 'Menu mùa thu, không khí ấm cúng, nhạc không lời', ['sub'], 20, 'running', { progress: 44 })
  o2.lastStep = now
  const o1 = mk(me, 'logo', 'Mộc An', 'Mộc mạc, màu đất, chữ có chân mềm', ['mini'], 30, 'client_review', { version: 2, revisionsUsed: 1 })
  o1.revisions.push({ version: 1, t: now - 8 * HOUR, note: 'Nét chữ mảnh quá khi in lên ly', annots: [{ id: 1, x: 62, y: 30, text: 'Bỏ chiếc lá thứ hai cho gọn' }] })
  o1.events.push(ev(now - 8 * HOUR, 'client', 'Bạn đã gửi 2 góp ý cho bản v1'), ev(now - 4 * HOUR, 'mai', 'Hoàn thành bản nháp v2, gửi kiểm tra chất lượng'), ev(now - 3 * HOUR, 'lan', 'Kiểm tra chất lượng v2: đạt 5/5 tiêu chí'), ev(now - 2 * HOUR, 'owner', 'Chuyên viên đã duyệt bản v2 và gửi bạn', { version: 2 }))
  notify(d, 'Mộc An: bản nháp logo v2 chờ bạn duyệt', `#/app/don-hang/${o1.code}/ban-nhap`, { customer: me })
  makeQuote(d, me, 'landing', 'Mộc An', 'Trang đặt bàn, ảnh không gian quán', ['form'], false, now - HOUR)
  const qx = makeQuote(d, me, 'post', 'Mộc An', 'Bộ post Trung thu', ['more3'], false, now - 50 * HOUR); qx.status = 'expired'; qx.expiresAt = now - 26 * HOUR
  d.ledger.push({ id: uid(), t: now - 10 * DAY, customer: me, delta: 300_000, text: 'Credit tặng khách quen' })
  d.orders.forEach((o) => { if (o.job === 'pending_approval' || o.plan?.status === 'pending') o.reviewer = pickReviewer(d, o.service) })
  const ask = d.orders.find((o) => o.customer === me && o.status === 'active' && o.job === 'running')
  if (ask) { ask.job = 'input_required'; ask.input = { q: `Em cần thêm thông tin: ${ask.brand} muốn dùng ảnh thật của quán hay ảnh minh họa ạ?`, t: now - 40 * 60_000 }; ask.events.push(ev(now - 40 * 60_000, findService(ask.service)!.agent, 'Cần thêm thông tin từ khách — đã gửi câu hỏi')) }
  d.sales.push({ ...seedSales(me, 'Quán Mộc An', 'live', now, 12), help: [{ id: uid(), t: now - 26 * HOUR, text: 'Em muốn agent trả lời thêm về menu bánh ngọt mới, nhờ studio soạn giúp.', status: 'done', reply: 'Studio đã thêm 3 mục bánh ngọt vào Kiến thức ở trạng thái đề xuất, chị duyệt giúp nhé.', by: 'Thảo' }] })
  d.orders.sort((a, b) => b.createdAt - a.createdAt)
  return d
}

export const providerName = (d: DB, id?: string) => d.providers.find((p) => p.id === id)?.name ?? '—'
function seedStaff(now: number): Member[] {
  return [
    { id: 'longca', name: 'Longca', email: 'longca@aistudio.vn', role: 'admin', active: true, skills: ['logo', 'post', 'video', 'landing'], maxQueue: 20, createdAt: now - 90 * DAY },
    { id: 'linh', name: 'Linh', email: 'linh@aistudio.vn', role: 'manager', active: true, skills: ['logo', 'post', 'video', 'landing'], maxQueue: 16, createdAt: now - 65 * DAY },
    { id: 'thao', name: 'Thảo', email: 'thao@aistudio.vn', role: 'specialist', active: true, skills: ['logo', 'post'], maxQueue: 12, createdAt: now - 40 * DAY },
    { id: 'quan', name: 'Quân', email: 'quan@aistudio.vn', role: 'specialist', active: true, skills: ['video', 'landing'], maxQueue: 8, createdAt: now - 12 * DAY },
    { id: 'ngan', name: 'Ngân', email: 'ngan@aistudio.vn', role: 'finance', active: true, skills: ['post'], maxQueue: 4, createdAt: now - 25 * DAY },
  ]
}
function seedProviders(now: number): Provider[] {
  return [
    { id: 'pho-ve', name: 'Studio Phố Vẽ', contact: 'Trúc', email: 'truc@phove.vn', skills: ['logo', 'post'], status: 'active', share: 0.7, bank: 'VCB ••••4821', portfolio: ['Bộ nhận diện Trà Cúc', 'Social Tết tiệm bánh Ngói'], bio: 'Nhóm 3 designer ở Đà Nẵng, mạnh nhận diện F&B.', joinedAt: now - 60 * DAY },
    { id: 'khung-hinh', name: 'Khung Hình Media', contact: 'Phát', email: 'phat@khunghinh.vn', skills: ['video'], status: 'active', share: 0.7, bank: 'TCB ••••0193', portfolio: ['TVC 15s spa Lá', 'Reels quán nướng'], bio: 'Dựng video ngắn dọc cho TikTok/Reels.', joinedAt: now - 30 * DAY },
    { id: 'web-nhanh', name: 'Web Nhanh', contact: 'Duy', email: 'duy@webnhanh.vn', skills: ['landing'], status: 'pending', share: 0.65, bank: 'MB ••••7712', portfolio: ['Landing khóa học Yoga'], bio: 'WordPress/Flatsome, giao trong 3 ngày.', joinedAt: now - 2 * DAY },
  ]
}
function seedOffers(now: number): Offer[] {
  const base = { bids: [], msgs: [], revisions: 0 }
  return [
    { ...base, id: 'MK-101', service: 'post', title: 'Bộ 8 bài Tết cho tiệm trà', brief: 'Tông đỏ gạch, chữ viết tay, 4 bài sản phẩm + 4 bài không khí. Logo và ảnh sản phẩm có sẵn.', budget: 480_000, dueAt: now + 2 * DAY, status: 'open', createdAt: now - 3 * HOUR, bids: [{ provider: 'pho-ve', note: 'Bên em làm Tết F&B nhiều, giao trong 36 giờ.', days: 2, t: now - HOUR }] },
    { ...base, id: 'MK-102', service: 'video', title: 'Video 15 giây giới thiệu spa', brief: 'Dọc 9:16, nhạc nhẹ, phụ đề tiếng Việt, 5 cảnh từ ảnh khách gửi.', budget: 690_000, dueAt: now + 3 * DAY, status: 'open', createdAt: now - 6 * HOUR },
    { ...base, id: 'MK-098', service: 'logo', title: 'Logo tiệm sửa xe', brief: 'Mạnh, dễ nhìn trên biển hiệu, 2 màu.', budget: 690_000, dueAt: now + DAY, status: 'accepted', provider: 'pho-ve', createdAt: now - 2 * DAY, msgs: [{ from: 'provider', text: 'Khách có màu bắt buộc không ạ?', t: now - 20 * HOUR }, { from: 'studio', text: 'Ưu tiên đỏ và đen, tránh xanh lá.', t: now - 19 * HOUR }] },
    { ...base, id: 'MK-095', service: 'video', title: 'Reels khai trương quán nướng', brief: '3 clip 10 giây, chữ to, nhạc sôi động.', budget: 540_000, dueAt: now - 2 * HOUR, status: 'delivered', provider: 'khung-hinh', createdAt: now - 3 * DAY, delivery: { link: 'https://drive.google.com/khunghinh-mk095', note: '3 bản 9:16, có file dự án.', t: now - 3 * HOUR } },
    { ...base, id: 'MK-090', service: 'post', title: '4 bài khai trương tiệm nail', brief: 'Pastel, có ưu đãi 20%.', budget: 350_000, dueAt: now - 2 * DAY, status: 'approved', provider: 'pho-ve', createdAt: now - 6 * DAY, rating: 5, review: 'Đúng brief, giao sớm.', payout: { amount: 245_000, status: 'paid', paidAt: now - 4 * DAY } },
    { ...base, id: 'MK-088', service: 'logo', title: 'Logo tiệm hoa', brief: 'Mềm mại, nét mảnh.', budget: 600_000, dueAt: now - 5 * DAY, status: 'approved', provider: 'pho-ve', createdAt: now - 9 * DAY, rating: 4, review: 'Cần sửa 1 lần về khoảng cách chữ.', revisions: 1, payout: { amount: 420_000, status: 'pending' } },
  ]
}
function agentDiff(a: AgentCfg, b: AgentCfg) {
  const ch: string[] = []
  if (a.enabled !== b.enabled) ch.push(b.enabled ? 'bật' : 'tắt')
  if (a.runtime !== b.runtime) ch.push(`runtime → ${b.runtime}`)
  if (a.tier !== b.tier) ch.push(`tầng ${a.tier} → ${b.tier}`)
  if (a.data !== b.data) ch.push(`quyền dữ liệu → ${b.data}`)
  const add = b.tools.filter((t) => !a.tools.includes(t)), rm = a.tools.filter((t) => !b.tools.includes(t))
  if (add.length) ch.push(`cấp tool ${add.join(', ')}`)
  if (rm.length) ch.push(`thu hồi tool ${rm.join(', ')}`)
  if (a.approval.join() !== b.approval.join()) ch.push(`duyệt trước: ${b.approval.join(', ') || 'không'}`)
  if (a.capJob !== b.capJob || a.capDay !== b.capDay) ch.push(`trần ${vndS(b.capJob)}/job, ${vndS(b.capDay)}/ngày`)
  return `${b.name}: ${ch.join('; ') || 'lưu không đổi'}`
}
const OPENCLAW_TOOLS = ['canva.autofill', 'figma.write', 'seedance.generate', 'wordpress.deploy', 'browser.research', 'files.upload', 'gbrain.search']
function seedRuntimes(now: number): Runtime[] {
  return [
    { id: 'portal', name: 'Sandbox portal', kind: 'custom', endpoint: 'nội bộ', status: 'connected', lastBeat: now, latencyMs: 40, tools: ['pricing.quote', 'order.create', 'payment.create', 'knowledge.search', 'lead.create'], keyHint: '—', note: 'Chạy agent nói chuyện với khách. Không có tool sản xuất.' },
    { id: 'openclaw', name: 'OpenClaw · prized.dev', kind: 'openclaw', endpoint: 'https://openclaw.prized.dev/a2a', status: 'connected', lastBeat: now, latencyMs: 180, tools: OPENCLAW_TOOLS, keyHint: '••••3f9a', note: '1 operator tin cậy. Chạy agent sản xuất và kiểm tra.' },
    { id: 'hermes', name: 'Hermes Agent', kind: 'hermes', endpoint: '', status: 'disconnected', lastBeat: 0, latencyMs: 0, tools: [], keyHint: '', note: 'Thử sau OpenClaw.' },
  ]
}
function seedAgents(): AgentCfg[] {
  const a = (id: AgentId, name: string, role: string, runtime: string, tier: AgentCfg['tier'], tools: string[], data: AgentCfg['data'], customerFacing = false, approval: string[] = []): AgentCfg =>
    ({ id, name, role, runtime, tier, autoEscalate: true, tools, data, capJob: 150_000, capDay: 1_500_000, spentToday: 0, approval, enabled: true, customerFacing })
  return [
    a('intake', 'Trợ lý tiếp nhận', 'Chat với khách, lên brief, báo giá từ engine', 'portal', 'fast', ['pricing.quote', 'order.create', 'payment.create'], 'brief_profile', true),
    a('orchestrator', 'Agent điều phối', 'Lập kế hoạch, giao việc, theo dõi SLA và chi phí', 'openclaw', 'pro', ['gbrain.search'], 'brief'),
    a('research', 'Agent research', 'Tìm thông tin bổ sung, luôn ghi nguồn', 'openclaw', 'fast', ['browser.research', 'gbrain.search'], 'brief'),
    a('mai', 'Mai', 'Thiết kế (Canva, Figma)', 'openclaw', 'standard', ['canva.autofill', 'figma.write', 'files.upload'], 'brief', false, ['Xóa tệp', 'Đăng bài lên kênh của khách']),
    a('khoa', 'Khoa', 'Video (Seedance)', 'openclaw', 'standard', ['seedance.generate', 'files.upload'], 'brief'),
    { ...a('minh', 'Minh', 'Web (WordPress, Flatsome)', 'openclaw', 'standard', ['wordpress.deploy', 'files.upload', 'browser.research'], 'brief', false, ['Đăng bài lên kênh của khách']), capJob: 320_000 },
    a('lan', 'Lan', 'Kiểm tra chất lượng', 'openclaw', 'fast', ['files.upload'], 'brief'),
    a('sales', 'Agent bán hàng (theo khách)', 'Tư vấn người mua theo kho kiến thức của từng khách, chuyển lead', 'portal', 'fast', ['knowledge.search', 'lead.create'], 'workspace', true, ['Gửi tin nhắn ra ngoài nền tảng']),
  ]
}
function seedSales(customer: string, name: string, status: SalesAgent['status'], now: number, ageD: number): SalesAgent {
  const t0 = now - ageD * DAY
  const k = (kind: KItem['kind'], title: string, body: string, source: KItem['source'] = 'client', st: KItem['status'] = 'approved', sourceUrl?: string): KItem => ({ id: uid(), kind, title, body, source, status: st, sourceUrl, comments: [], t: t0 })
  const fnb = customer === 'moc-an'
  const knowledge: KItem[] = fnb ? [
    k('profile', 'Giờ mở cửa', 'Dạ quán mở cửa 7:00–22:00 tất cả các ngày, kể cả lễ Tết ạ.'),
    k('profile', 'Địa chỉ', 'Quán ở 12 Nguyễn Thị Minh Khai, quận 3, có chỗ để xe máy trước cửa ạ.'),
    k('product', 'Cà phê muối', 'Cà phê muối 39.000đ — món bán chạy nhất của quán, vị mặn nhẹ béo ngậy ạ.'),
    k('product', 'Bạc xỉu', 'Bạc xỉu 35.000đ, ít đắng, hợp người mới uống cà phê ạ.'),
    k('product', 'Hạt rang mộc 250g', 'Hạt rang mộc 250g giá 160.000đ, rang vừa, có hộp quà thêm 20.000đ ạ.'),
    k('faq', 'Giao hàng', 'Dạ quán giao trong bán kính 5km qua GrabFood/ShopeeFood, đơn sỉ từ 20 ly quán tự giao miễn phí ạ.'),
    k('faq', 'Hóa đơn VAT', 'Dạ quán xuất hóa đơn VAT cho đơn từ 500.000đ, mình gửi thông tin công ty giúp em nhé.'),
    k('scenario', 'Khách chê giá đắt', 'Dạ quán dùng hạt Robusta Cầu Đất rang mộc và sữa tươi, nên giá nhỉnh hơn một chút nhưng vị đậm và an toàn ạ. Mình thử size nhỏ trước nha.'),
    k('limit', 'Giảm giá', 'Dạ đơn từ 20 ly quán giảm 10%; đơn lẻ hiện chưa có khuyến mãi ạ.'),
    k('faq', 'Đổi trả', 'Dạ nếu đồ uống không đúng vị hoặc giao trễ, quán làm lại ly mới hoặc hoàn tiền ngay ạ.'),
    k('product', 'Không gian làm việc', 'Quán có wifi mạnh, ổ cắm ở mọi bàn, khu yên tĩnh tầng 2 phù hợp làm việc ạ.', 'research', 'proposed', 'Google Maps · đánh giá 4,7★'),
    k('scenario', 'So sánh với quán bên cạnh', 'Khách đánh giá quán yên tĩnh hơn và có cà phê muối ngon; nên nhấn mạnh không gian tầng 2.', 'research', 'proposed', 'Đánh giá Google Maps & Foody'),
    k('faq', 'Đặt tiệc sinh nhật', 'Quán nhận đặt tầng 2 cho nhóm 8–15 người, cọc 30%.', 'learned', 'proposed'),
  ] : [
    k('profile', 'Giờ mở cửa', 'Dạ cửa hàng mở 8:00–21:30 hằng ngày ạ.'),
    k('product', 'Sách thiếu nhi', 'Tủ sách thiếu nhi hơn 2.000 đầu sách, giảm 15% cho thẻ thành viên ạ.'),
    k('faq', 'Giao hàng', 'Dạ giao toàn quốc 2–4 ngày, miễn phí đơn từ 300.000đ ạ.'),
    k('faq', 'Đổi trả', 'Dạ đổi trả trong 7 ngày nếu sách lỗi in ấn ạ.'),
    k('profile', 'Địa chỉ', 'Dạ nhà sách ở 45 Trần Quang Khải, quận 1 và giao online toàn quốc ạ.'),
    k('product', 'Bán chạy', 'Dạ tuần này bán chạy nhất là “Muôn kiếp nhân sinh” 168.000đ và bộ “Doraemon” 25.000đ/cuốn ạ.'),
    k('limit', 'Giảm giá', 'Dạ thẻ thành viên giảm 15%, đơn sỉ từ 20 cuốn giảm 20% ạ. Giá từng cuốn in trên bìa.'),
    k('faq', 'Hóa đơn', 'Dạ nhà sách xuất hóa đơn VAT cho mọi đơn, mình gửi mã số thuế giúp em ạ.'),
  ]
  const channels = (['web', 'zalo', 'messenger', 'instagram', 'telegram', 'api'] as ChannelId[]).map((id) => ({ id, connected: status === 'live' && (id === 'web' || id === 'zalo'), detail: status === 'live' ? (id === 'web' ? (fnb ? 'mocan.vn' : 'sachgio.vn') : id === 'zalo' ? 'OA ' + name : '') : '', conv: status === 'live' ? (id === 'web' ? 180 : id === 'zalo' ? 96 : 0) : 0 }))
  const leads: Lead[] = status === 'live' ? poolFor(customer).slice(0, 3).map((l, i) => ({ ...l, id: uid(), t: now - (i * 7 + 2) * HOUR, phone: '090' + (1234567 + i * 1111), status: (['new', 'sent', 'won'] as const)[i], channel: i ? 'zalo' : 'web', consentAt: now - (i * 7 + 2) * HOUR, assignee: fnb ? (['han', 'tuan', 'han'] as const)[i] : 'bao', note: i === 2 ? (fnb ? 'Đã chốt 30 ly, giao thứ 6' : 'Đã chốt 25 cuốn, giao thứ 2') : '', product: fnb ? 'Cà phê muối' : 'Sách thiếu nhi' })) : []
  const terms: SalesTerms | null = status === 'live' ? { monthly: 1_200_000, includedConv: 1000, extraPerConv: 800, leadFee: 0, note: 'Thỏa thuận 6 tháng đầu', acceptedAt: t0 } : null
  return { customer, name: `Trợ lý bán hàng ${name}`, tone: 'Thân thiện, xưng "em", gọi khách là "mình"', status, knowledge, channels, leads, handoffTo: fnb ? 'chị Hân' : 'anh Bảo', maxDiscountPct: 10, team: fnb ? [{ id: 'han', name: 'Chị Hân', phone: '0903 112 233', active: true }, { id: 'tuan', name: 'Tuấn (thu ngân)', phone: '0938 445 566', active: true }] : [{ id: 'bao', name: 'Anh Bảo', phone: '0912 778 899', active: true }], test: status === 'live' ? { ...runTest(knowledge), at: t0 } : null, terms, termsRequested: status === 'live', conv: status === 'live' ? 276 : 0, createdAt: t0, lastSim: now }
}

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const d = JSON.parse(raw) as DB
      // Discard data saved by an older/partial schema instead of crashing on missing fields.
      if (d?.session?.client && Array.isArray(d.runtimes) && Array.isArray(d.sales) && Array.isArray(d.threads) && Array.isArray(d.catalog) && d.settings && d.customers?.some((c) => c.id === d.me)) { d.audit ??= []; d.offers ??= []; d.session.staff ??= 'admin'; d.staff ??= seedStaff(Date.now()); d.actions ??= []; d.session.member ??= d.session.staff === 'admin' ? 'longca' : 'thao'; if (typeof d.session.provider !== 'string' || !Array.isArray(d.providers) || !d.offers.every((o) => Array.isArray(o.bids))) { d.session.provider = ''; d.providers = seedProviders(Date.now()); d.offers = seedOffers(Date.now()) } return d }
    }
  } catch { /* ignore */ }
  return seed()
}

/* ================= store ================= */
function useStoreImpl() {
  const [db, setDb] = useState<DB>(load)
  const ref = useRef(db)
  const [typing, setTyping] = useState(false)
  const commit = useCallback(<R,>(fn: (d: DB) => R): R => {
    const d = structuredClone(ref.current) as DB
    const r = fn(d)
    ref.current = d
    setDb(d)
    return r
  }, [])
  const hydrateAppSnapshot = useCallback((snapshot: AppSnapshot) => {
    if (!snapshot.authenticated) return
    commit((d) => {
      if (snapshot.kind === 'staff') {
        d.session.admin = true
        d.session.staff = snapshot.user.role
        d.session.member = snapshot.user.id
        const existing = d.staff.findIndex((member) => member.id === snapshot.user.id || member.email === snapshot.user.email)
        const member: Member = {
          id: snapshot.user.id, name: snapshot.user.name, email: snapshot.user.email, role: snapshot.user.role,
          active: true, skills: existing >= 0 ? d.staff[existing].skills : [], maxQueue: existing >= 0 ? d.staff[existing].maxQueue : 8,
          permissions: existing >= 0 ? d.staff[existing].permissions : undefined,
          createdAt: existing >= 0 ? d.staff[existing].createdAt : Date.now(),
        }
        if (existing >= 0) d.staff[existing] = member
        else d.staff.push(member)
        return
      }
      const id = snapshot.user.id
      d.me = id
      d.session.client = { loggedIn: true, email: snapshot.user.email, onboarded: Boolean(snapshot.user.name && snapshot.user.businessName) }
      const customerIndex = d.customers.findIndex((customer) => customer.id === id || customer.email === snapshot.user.email)
      if (customerIndex >= 0) d.customers[customerIndex] = { ...d.customers[customerIndex], ...snapshot.customer }
      else d.customers.push(snapshot.customer)
      const quoteCodes = new Set(snapshot.quotes.map((quote) => quote.code))
      const orderCodes = new Set(snapshot.orders.map((order) => order.code))
      const paymentIDs = new Set(snapshot.payments.map((payment) => payment.id))
      d.quotes = [...snapshot.quotes, ...d.quotes.filter((quote) => quote.customer !== id && !quoteCodes.has(quote.code))]
      d.orders = [...snapshot.orders, ...d.orders.filter((order) => order.customer !== id && !orderCodes.has(order.code))]
      d.payments = [...snapshot.payments, ...d.payments.filter((payment) => payment.customer !== id && !paymentIDs.has(payment.id))]
      const previous = d.threads.find((item) => item.id === id || item.customer === id)
      const hydrated: Thread = { ...snapshot.thread, intake: previous?.intake ?? emptyIntake() }
      d.threads = [hydrated, ...d.threads.filter((item) => item.id !== id && item.customer !== id)]
    })
  }, [commit])

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(db)) }, [db])
  useEffect(() => { void getAppSnapshot().then(hydrateAppSnapshot).catch(() => undefined) }, [hydrateAppSnapshot])
  useEffect(() => {
    const t = setInterval(() => {
      const d = structuredClone(ref.current) as DB
      if (tick(d, Date.now())) { ref.current = d; setDb(d) }
    }, 700)
    return () => clearInterval(t)
  }, [])

  const order = (d: DB, code: string) => d.orders.find((x) => x.code === code)!
  const thread = (d: DB, id: string) => d.threads.find((x) => x.id === id)!

  const actions = {
    /* ---- auth ---- */
    async syncApp() { const snapshot = await getAppSnapshot(); hydrateAppSnapshot(snapshot); return snapshot.authenticated },
    login(email: string) { commit((d) => { d.session.client = { loggedIn: true, email, onboarded: !!d.customers.find((c) => c.id === d.me)?.name }; const c = d.customers.find((x) => x.id === d.me)!; if (!c.email) c.email = email }) },
    logout() { commit((d) => { d.session.client.loggedIn = false }) },
    adminLogin(role: StaffRole = 'admin', member?: string) { commit((d) => { d.session.admin = true; d.session.staff = role; d.session.member = member ?? (role === 'admin' ? 'longca' : 'thao') }) },
    setStaffRole(role: StaffRole, member?: string) { commit((d) => { d.session.admin = true; d.session.staff = role; d.session.member = member ?? (role === 'admin' ? 'longca' : d.session.member && d.session.member !== 'longca' ? d.session.member : 'thao') }) },
providerLogin(id: string) { commit((d) => { d.session.provider = id }) },
    providerLogout() { commit((d) => { d.session.provider = '' }) },
    /* ---- marketplace ---- */
    postOffer(o: { service: ServiceCode; title: string; brief: string; budget: number; dueAt: number; orderCode?: string }) {
      return commit((d) => {
        const id = 'MK-' + (110 + d.offers.length)
        d.offers.unshift({ ...o, id, status: 'open', createdAt: Date.now(), bids: [], msgs: [], revisions: 0 })
        d.providers.filter((p) => p.status === 'active' && p.skills.includes(o.service)).forEach((p) => notify(d, `Việc mới phù hợp: ${o.title}`, `#/doi-tac/viec/${id}`, { provider: p.id }))
        audit(d, 'admin', 'runtime', `Đăng việc ${id} lên marketplace · ${vndS(o.budget)}${o.orderCode ? ` (từ đơn ${o.orderCode})` : ''}`)
        return id
      })
    },
    /** Chuyển một đơn đang chạy cho đối tác: tạm giữ đơn, brief đã ẩn thông tin khách. */
    outsource(code: string, budget: number, days: number) {
      commit((d) => {
        const o = order(d, code)
        const id = 'MK-' + (110 + d.offers.length)
        d.offers.unshift({ id, orderCode: code, service: o.service, title: `${findService(o.service)!.name} · ${o.brand}`, brief: `${o.style}. Thương hiệu: ${o.brand}. Thông tin liên hệ khách được ẩn.`, budget, dueAt: Date.now() + days * DAY, status: 'open', createdAt: Date.now(), bids: [], msgs: [], revisions: 0 })
        o.prevJob = o.job; o.job = 'on_hold'; o.offerId = id
        o.events.push(ev(Date.now(), 'owner', `Chuyển cho đối tác qua marketplace (${id})`, { internal: true }))
        d.providers.filter((p) => p.status === 'active' && p.skills.includes(o.service)).forEach((p) => notify(d, `Việc mới phù hợp: ${o.brand}`, `#/doi-tac/viec/${id}`, { provider: p.id }))
        audit(d, 'admin', 'runtime', `Chuyển ${code} cho marketplace ${id} · ${vndS(budget)}`, o.customer)
      })
    },
    providerApply(id: string, note: string, days: number) { commit((d) => { const o = d.offers.find((x) => x.id === id)!; o.bids = o.bids.filter((b) => b.provider !== d.session.provider).concat({ provider: d.session.provider, note, days, t: Date.now() }); notify(d, `${providerName(d, d.session.provider)} ứng tuyển ${id}`, `#/admin/doi-tac/${id}`, { forAdmin: true }) }) },
    assignOffer(id: string, provider: string) { commit((d) => { const o = d.offers.find((x) => x.id === id)!; o.status = 'accepted'; o.provider = provider; notify(d, `Bạn được chọn cho ${id}: ${o.title}`, `#/doi-tac/viec/${id}`, { provider }); audit(d, 'admin', 'runtime', `Giao ${id} cho ${providerName(d, provider)}`) }) },
    offerMsg(id: string, text: string, from: 'studio' | 'provider') { commit((d) => { const o = d.offers.find((x) => x.id === id)!; o.msgs.push({ from, text, t: Date.now() }); if (from === 'provider') notify(d, `${providerName(d, o.provider)} hỏi về ${id}`, `#/admin/doi-tac/${id}`, { forAdmin: true }); else if (o.provider) notify(d, `Studio trả lời về ${id}`, `#/doi-tac/viec/${id}`, { provider: o.provider }) }) },
    providerDeliver(id: string, link: string, note: string) { commit((d) => { const o = d.offers.find((x) => x.id === id)!; o.status = 'delivered'; o.delivery = { link, note, t: Date.now() }; notify(d, `${providerName(d, o.provider)} đã giao ${id} — cần QC`, `#/admin/doi-tac/${id}`, { forAdmin: true }) }) },
    /** QC đạt: chấm điểm, ghi nợ chi trả; nếu gắn đơn thì đưa bản giao vào kiểm tra chất lượng như bản agent. */
    acceptOffer(id: string, rating: number, review: string) {
      commit((d) => {
        const o = d.offers.find((x) => x.id === id)!, p = d.providers.find((x) => x.id === o.provider)!
        o.status = 'approved'; o.rating = rating; o.review = review; o.payout = { amount: Math.round(o.budget * p.share), status: 'pending' }
        notify(d, `${id} đạt QC · ${rating}/5 — chờ chi trả ${vndS(o.payout.amount)}`, `#/doi-tac/viec/${id}`, { provider: p.id })
        if (o.orderCode) { const ord = order(d, o.orderCode); ord.version++; ord.job = 'qc_review'; ord.prevJob = undefined; ord.progress = 100; ord.lastStep = 0; ord.events.push(ev(Date.now(), 'system', `Nhận bản v${ord.version} từ đối tác ${p.name}, chuyển kiểm tra chất lượng`, { internal: true })) }
        audit(d, 'admin', 'runtime', `Duyệt bài giao ${id} của ${p.name} · ${rating}/5`)
      })
    },
    reviseOffer(id: string, note: string) { commit((d) => { const o = d.offers.find((x) => x.id === id)!; o.status = 'accepted'; o.revisions++; o.msgs.push({ from: 'studio', text: `Yêu cầu sửa: ${note}`, t: Date.now() }); notify(d, `Studio yêu cầu sửa ${id}`, `#/doi-tac/viec/${id}`, { provider: o.provider }) }) },
    cancelOffer(id: string) { commit((d) => { const o = d.offers.find((x) => x.id === id)!; o.status = 'canceled'; if (o.orderCode) { const ord = order(d, o.orderCode); if (ord.job === 'on_hold') { ord.job = ord.prevJob ?? 'queued'; ord.prevJob = undefined; ord.lastStep = 0; ord.events.push(ev(Date.now(), 'owner', 'Rút khỏi marketplace, agent tiếp tục làm', { internal: true })) } } }) },
    payOut(id: string) { commit((d) => { const o = d.offers.find((x) => x.id === id)!; o.payout = { ...o.payout!, status: 'paid', paidAt: Date.now() }; notify(d, `Đã chi trả ${vndS(o.payout.amount)} cho ${id}`, '#/doi-tac/thu-nhap', { provider: o.provider }); audit(d, 'admin', 'runtime', `Chi trả ${vndS(o.payout.amount)} cho ${providerName(d, o.provider)} (${id})`) }) },
    providerSignup(p: { name: string; contact: string; email: string; skills: ServiceCode[]; bio: string; portfolio: string[] }) { return commit((d) => { const id = 'p-' + uid().slice(0, 5); d.providers.push({ ...p, id, status: 'pending', share: 0.65, bank: '', joinedAt: Date.now() }); d.session.provider = id; notify(d, `Đối tác mới đăng ký: ${p.name}`, '#/admin/doi-tac', { forAdmin: true }); return id }) },
    updateProvider(id: string, patch: Partial<Provider>) { commit((d) => { const p = d.providers.find((x) => x.id === id)!; if (patch.bank && !patch.bank.includes('••••')) { const m = patch.bank.match(/^(\D*?)\s*(\d+)\s*$/); patch.bank = m ? `${m[1].trim() || 'TK'} ••••${m[2].slice(-4)}` : patch.bank } Object.assign(p, patch); if (patch.status) { audit(d, 'admin', 'runtime', `Đối tác ${p.name} → ${patch.status}`); notify(d, patch.status === 'active' ? 'Hồ sơ đối tác đã được duyệt' : patch.status === 'suspended' ? 'Tài khoản đối tác bị tạm khóa' : 'Hồ sơ đối tác cập nhật', '#/doi-tac', { provider: id }) } }) },
    adminLogout() { commit((d) => { d.session.admin = false }) },
    saveProfile(patch: Partial<Customer>) { commit((d) => { Object.assign(d.customers.find((c) => c.id === d.me)!, patch); d.session.client.onboarded = true }) },

    /* ---- chat ---- */
    send(text: string) {
      const t = text.trim()
      if (!t || typing) return
      const me = ref.current.me
      commit((d) => {
        const th = thread(d, me)
        th.messages.push({ id: uid(), from: 'me', text: t, t: Date.now() })
        if (th.handoff || th.takeover || !d.settings.aiEnabled) { th.unread++; notify(d, `${customerName(d, me)}: “${t.slice(0, 40)}”`, `#/admin/hop-thu/${me}`, { forAdmin: true }) }
      })
      const th = thread(ref.current, me)
      if (th.handoff || th.takeover || !ref.current.settings.aiEnabled) {
        void persistConversationTurn({ clientText: t, handoff: true })
        return
      }
      setTyping(true)
      setTimeout(() => {
        setTyping(false)
        let quoteInput: Parameters<typeof persistQuote>[0] | undefined
        let assistantText = ''
        let quoteCode: string | undefined
        let handoff = false
        commit((d) => {
          const th = thread(d, me)
          if (th.takeover) return
          const r = nextReply(t, th.intake, activeServices(d))
          assistantText = r.text
          handoff = Boolean(r.handoff)
          th.intake = r.state
          const msg: Msg = { id: uid(), from: 'ai', text: r.text, t: Date.now(), chips: r.chips }
          if (r.readyToQuote) {
            const s = r.state
            const q = makeQuote(d, me, s.service!, s.brand!, s.style!, s.options, !!s.rush)
            msg.quoteCode = q.code
            quoteCode = q.code
            quoteInput = { code: q.code, serviceCode: q.service, brand: q.brand, brief: q.style, options: q.options, rush: q.rush }
            notify(d, `Báo giá ${q.code} đã sẵn sàng`, `#/app/bao-gia/${q.code}`, { customer: me })
            notify(d, `${customerName(d, me)} nhận báo giá ${q.code} · ${vndS(q.price.total)}`, '#/admin/don-hang', { forAdmin: true })
          }
          if (r.handoff) { th.handoff = true; th.unread++; notify(d, `${customerName(d, me)} cần chuyên viên trả lời`, `#/admin/hop-thu/${me}`, { forAdmin: true }) }
          th.messages.push(msg)
        })
        void (async () => {
          if (quoteInput) await persistQuote(quoteInput)
          if (assistantText) await persistConversationTurn({ clientText: t, assistantText, quoteCode, handoff })
        })()
      }, 750 + Math.random() * 500)
    },
    newIntake() {
      commit((d) => {
        const th = thread(d, d.me)
        th.intake = emptyIntake(); th.handoff = false
        th.messages.push({ id: uid(), from: 'ai', t: Date.now(), text: 'Dạ, mình bắt đầu yêu cầu mới nhé. Chị cần làm gì ạ?', chips: activeServices(d).map((c) => c.short) })
      })
    },
    ownerSend(threadId: string, text: string, quoteCode?: string) {
      let customerID = threadId
      commit((d) => {
        const th = thread(d, threadId)
        customerID = th.customer
        th.messages.push({ id: uid(), from: 'owner', text, t: Date.now(), quoteCode })
        th.unread = 0
        notify(d, `Chuyên viên Longca: “${text.slice(0, 48)}”`, '#/app/chat', { customer: th.customer })
      })
      void persistStaffMessage(customerID, text, quoteCode)
    },
    setTakeover(threadId: string, on: boolean) {
      let customerID = threadId
      commit((d) => {
        const th = thread(d, threadId)
        customerID = th.customer
        th.takeover = on
        if (!on) { th.handoff = false; th.messages.push({ id: uid(), from: 'ai', t: Date.now(), text: 'Em là trợ lý AI, em tiếp tục hỗ trợ chị ạ. Chị cần gì thêm cứ nhắn em nhé.' }) }
      })
      void updateStaffConversation(customerID, { takeover: on })
    },
    readThread(threadId: string) { let customerID = threadId; commit((d) => { const th = thread(d, threadId); customerID = th.customer; th.unread = 0 }); void markStaffConversationRead(customerID) },
    saveThreadNote(threadId: string, note: string) { let customerID = threadId; commit((d) => { const th = thread(d, threadId); customerID = th.customer; th.note = note }); void updateStaffConversation(customerID, { note }) },
    hydrateInbox(snapshot: StaffInboxSnapshot) {
      commit((d) => {
        const customerIDs = new Set(snapshot.customers.map((customer) => customer.id))
        d.customers = [...snapshot.customers, ...d.customers.filter((customer) => !customerIDs.has(customer.id))]
        const threadCustomers = new Set(snapshot.threads.map((item) => item.customer))
        d.threads = [
          ...snapshot.threads.map((item) => ({ ...item, intake: d.threads.find((thread) => thread.customer === item.customer)?.intake ?? emptyIntake() })),
          ...d.threads.filter((item) => !threadCustomers.has(item.customer)),
        ]
      })
    },
    ownerQuote(threadId: string, svc: ServiceCode, options: string[], rush: boolean, style: string): string {
      let input: Parameters<typeof persistStaffQuote>[0] | undefined
      const code = commit((d) => {
        const c = d.customers.find((x) => x.id === threadId)!
        const q = makeQuote(d, c.id, svc, c.name, style, options, rush)
        input = { customerID: c.id, code: q.code, serviceCode: q.service, brand: q.brand, brief: q.style, options: q.options, rush: q.rush }
        thread(d, threadId).messages.push({ id: uid(), from: 'owner', t: Date.now(), text: 'Em gửi chị báo giá theo trao đổi nhé:', quoteCode: q.code })
        notify(d, `Báo giá ${q.code} từ chuyên viên`, `#/app/bao-gia/${q.code}`, { customer: c.id })
        return q.code
      })
      if (input) void persistStaffQuote(input)
      return code
    },

    /* ---- quotes & payments ---- */
    acceptQuote(code: string, method: 'qr' | 'credit' | 'mix' = 'qr'): { paymentId?: string; orderCode: string } | null {
      const accepted = commit((d) => {
        const q = d.quotes.find((x) => x.code === code)
        if (!q || q.status !== 'sent' || q.expiresAt < Date.now()) return null
        const now = Date.now()
        const o = makeOrder(d, q, now)
        o.events.push(ev(now, 'client', `Bạn đã chấp nhận báo giá ${q.code}`))
        const dep = q.price.depositAmount, credit = Math.max(0, creditOf(d, q.customer))
        const use = method === 'qr' ? 0 : Math.min(credit, dep)
        if (use > 0) {
          const pc = makePayment(d, q.customer, 'deposit', use, { orderCode: o.code }, now, 'credit')
          d.ledger.unshift({ id: uid(), t: now, customer: q.customer, delta: -use, text: `Trừ cọc ${o.code}`, orderCode: o.code })
          applyPaid(d, pc, now)
        }
        if (use >= dep) return { orderCode: o.code }
        return { orderCode: o.code, paymentId: makePayment(d, q.customer, 'deposit', dep - use, { orderCode: o.code }).id }
      })
      if (accepted) void acceptManagedQuote(code)
      return accepted
    },
    rejectQuote(code: string, reason: string) {
      commit((d) => { const q = d.quotes.find((x) => x.code === code); if (q && q.status === 'sent') { q.status = 'rejected'; q.rejectReason = reason } })
      void rejectManagedQuote(code, reason)
    },
    requote(code: string): string { return commit((d) => { const q = d.quotes.find((x) => x.code === code)!; return makeQuote(d, q.customer, q.service, q.brand, q.style, q.options, q.rush).code }) },
    /** Simulates a verified payOS webhook (signature + re-check + idempotency happen server-side). */
    markPaid(id: string) { commit((d) => { const p = d.payments.find((x) => x.id === id); if (p && p.status === 'pending') applyPaid(d, p, Date.now()) }) },
    renewPayment(id: string): string {
      return commit((d) => { const p = d.payments.find((x) => x.id === id)!; return makePayment(d, p.customer, p.kind, p.amount, { orderCode: p.orderCode, planCode: p.planCode }).id })
    },
    buyPlan(code: string): string { return commit((d) => makePayment(d, d.me, 'plan', findPlan(code)!.price, { planCode: code }).id) },
    cancelPlan() { commit((d) => { const c = d.customers.find((x) => x.id === d.me)!; c.plan = undefined }) },

    /* ---- order lifecycle ---- */
    cancelOrder(code: string, reason: string, by: 'client' | 'owner') {
      commit((d) => {
        const o = order(d, code)
        if (o.status === 'awaiting_deposit') o.job = 'canceled'
        else move(o, 'cancel')
        o.status = 'canceled'; o.cancelReason = reason
        d.payments.forEach((p) => { if (p.orderCode === code && p.status === 'pending') p.status = 'expired' })
        o.events.push(ev(Date.now(), by, `Đã hủy đơn: ${reason}`))
      })
    },
    /** Client approves draft → accepted; remaining balance is due before final files unlock (D2). */
    approveDraft(code: string): string | null {
      return commit((d) => {
        const o = order(d, code)
        move(o, 'client_accept')
        o.events.push(ev(Date.now(), 'client', `Bạn đã duyệt bản v${o.version}`))
        notify(d, `${customerName(d, o.customer)} đã duyệt ${o.code} v${o.version}`, `#/admin/viec/${o.code}`, { forAdmin: true })
        const rest = o.price.total - o.paid
        if (rest > 0) { o.status = 'awaiting_final'; return makePayment(d, o.customer, 'final', rest, { orderCode: o.code }).id }
        o.lastStep = 0
        return null
      })
    },
    payFinalWithCredit(code: string) {
      commit((d) => {
        const o = order(d, code), rest = o.price.total - o.paid, credit = creditOf(d, o.customer)
        if (credit < rest) return
        d.payments.forEach((p) => { if (p.orderCode === code && p.kind === 'final' && p.status === 'pending') p.status = 'expired' })
        const p = makePayment(d, o.customer, 'final', rest, { orderCode: code }, Date.now(), 'credit')
        d.ledger.unshift({ id: uid(), t: Date.now(), customer: o.customer, delta: -rest, text: `Thanh toán phần còn lại ${code}`, orderCode: code })
        applyPaid(d, p, Date.now())
      })
    },
    requestRevision(code: string, annots: Annot[], note: string, meta: Pick<Revision, 'capture' | 'captureAsset' | 'viewport'> = {}): 'ok' | 'no_revisions' | 'invalid' {
      if (annots.length === 0 && note.trim().length < 10) return 'invalid'
      return commit((d) => {
        const o = order(d, code)
        if (isRevisionBlocked(o)) return 'no_revisions'
        move(o, 'client_revision')
        o.revisionsUsed++; o.lastStep = Date.now()
        o.revisions.push({ version: o.version, annots: annots.map((a) => ({ ...a, status: a.status ?? 'open', replies: a.replies ?? [] })), note: note.trim(), t: Date.now(), ...meta })
        o.events.push(ev(Date.now(), 'client', `Bạn đã gửi ${annots.length + (note.trim() ? 1 : 0)} góp ý cho bản v${o.version}`))
        notify(d, `${o.code}: ${customerName(d, o.customer)} yêu cầu sửa v${o.version}`, `#/admin/viec/${o.code}`, { forAdmin: true })
        return 'ok'
      })
    },
    replyReview(code: string, annotId: number, text: string, from: 'client' | 'owner') {
      commit((d) => {
        const o = order(d, code)
        const a = o.revisions.flatMap((r) => r.annots).find((x) => x.id === annotId)
        if (!a || !text.trim()) return
        ;(a.replies ??= []).push({ id: uid(), t: Date.now(), from, text: text.trim() })
        if (from === 'client' && a.status === 'confirming') a.status = 'open'
        notify(d, from === 'owner' ? `Studio trả lời góp ý #${annotId.toString().slice(-3)}` : `${customerName(d, o.customer)} trả lời góp ý`, from === 'owner' ? `#/app/don-hang/${code}/ban-nhap` : `#/admin/viec/${code}`, from === 'owner' ? { customer: o.customer } : { forAdmin: true })
      })
    },
    setReviewStatus(code: string, annotId: number, status: ReviewStatus) {
      commit((d) => {
        const o = order(d, code)
        const a = o.revisions.flatMap((r) => r.annots).find((x) => x.id === annotId)
        if (!a) return
        a.status = status
        notify(d, `Góp ý “${a.text.slice(0, 36)}” → ${status === 'in_progress' ? 'đang xử lý' : status === 'fixed' ? 'đã sửa' : status === 'confirming' ? 'chờ xác nhận' : status === 'resolved' ? 'đã đóng' : 'mở lại'}`, `#/app/don-hang/${code}/ban-nhap`, { customer: o.customer })
      })
    },
    buyRevision(code: string): string { return commit((d) => { const o = order(d, code); return makePayment(d, o.customer, 'revision', d.settings.extraRevision, { orderCode: code }).id }) },

    /* ---- owner ---- */
    ownerApprove(code: string) {
      commit((d) => {
        const o = order(d, code)
        move(o, 'owner_approve')
        o.events.push(ev(Date.now(), 'owner', `Chuyên viên đã duyệt bản v${o.version} và gửi bạn`, { version: o.version }))
        notify(d, `${o.brand}: bản nháp v${o.version} chờ bạn duyệt`, `#/app/don-hang/${o.code}/ban-nhap`, { customer: o.customer })
      })
    },
    ownerReject(code: string, note: string) {
      commit((d) => {
        const o = order(d, code)
        move(o, 'owner_reject')
        o.progress = 55; o.rejectNote = note; o.lastStep = Date.now()
        o.events.push(ev(Date.now(), 'owner', `Chuyên viên trả lại v${o.version}: ${note}`, { internal: true }))
        const cfg = d.agents.find((a) => a.id === findService(o.service)?.agent)
        const cur = o.tier ?? cfg?.tier
        if (cfg?.autoEscalate && cur && cur !== 'pro') { o.tier = NEXT_TIER[cur]; o.events.push(ev(Date.now(), 'system', `Tự nâng tầng model ${TIERS[cur].label} → ${TIERS[o.tier].label} cho lần làm lại`, { internal: true })); audit(d, 'system', 'agent', `${o.code}: nâng tầng ${cfg.name} lên ${TIERS[o.tier].label} sau khi bị trả lại`, o.customer) }
      })
    },
    hold(code: string) { commit((d) => { const o = order(d, code); o.prevJob = o.job; move(o, 'hold'); o.events.push(ev(Date.now(), 'owner', 'Tạm dừng việc', { internal: true })) }) },
    resume(code: string) { commit((d) => { const o = order(d, code); o.job = o.prevJob ?? 'queued'; o.prevJob = undefined; o.lastStep = Date.now(); o.events.push(ev(Date.now(), 'owner', 'Tiếp tục việc', { internal: true })) }) },
    grantRevision(code: string) { commit((d) => { const o = order(d, code); o.extraRevisions++; o.events.push(ev(Date.now(), 'owner', 'Chuyên viên tặng thêm 1 lượt sửa')) }) },
    extendDue(code: string, days: number) { commit((d) => { const o = order(d, code); o.dueAt += days * DAY; o.events.push(ev(Date.now(), 'owner', `Gia hạn giao thêm ${days} ngày`)) }) },
    adjustCredit(customer: string, delta: number, text: string) { commit((d) => { d.ledger.unshift({ id: uid(), t: Date.now(), customer, delta, text }) }) },
    updateCustomer(id: string, patch: Partial<Customer>) { commit((d) => { Object.assign(d.customers.find((c) => c.id === id)!, patch) }) },
    savePrice(row: PriceRow) { commit((d) => { d.catalog = d.catalog.map((r) => (r.code === row.code ? row : r)) }) },
    saveSettings(patch: Partial<Settings>) { commit((d) => { Object.assign(d.settings, patch) }) },

    /* ---- runtimes & agents (admin) ---- */
    connectRuntime(id: string, endpoint: string, key: string) {
      commit((d) => { const r = d.runtimes.find((x) => x.id === id)!; audit(d, 'admin', 'runtime', `Kết nối ${r.name} tới ${endpoint}`); const card = adapterFor(r).discover(endpoint); Object.assign(r, { endpoint, keyHint: '••••' + key.slice(-4), status: 'connected', lastBeat: Date.now(), tools: card.tools }); r.latencyMs = adapterFor(r).health(r).latencyMs })
    },
    pingRuntime(id: string) { commit((d) => { const r = d.runtimes.find((x) => x.id === id)!; if (r.status !== 'disconnected') { const h = adapterFor(r).health(r); r.lastBeat = h.checkedAt; r.latencyMs = h.latencyMs || r.latencyMs } }) },
    setRuntimeStatus(id: string, status: Runtime['status']) { commit((d) => { d.runtimes.find((x) => x.id === id)!.status = status; audit(d, 'admin', 'runtime', `${d.runtimes.find((x) => x.id === id)!.name}: ${status === 'paused' ? 'dừng khẩn cấp' : status === 'connected' ? 'cho chạy lại' : 'ngắt kết nối'}`); notify(d, `Runtime ${id} → ${status === 'paused' ? 'đã dừng khẩn cấp' : status === 'connected' ? 'hoạt động lại' : 'ngắt kết nối'}`, '#/admin/agent', { forAdmin: true }) }) },
    addRuntime(name: string, endpoint: string) { commit((d) => { audit(d, 'admin', 'runtime', `Thêm runtime ${name}`); d.runtimes.push({ id: 'rt-' + uid().slice(0, 4), name, kind: 'custom', endpoint, status: 'disconnected', lastBeat: 0, latencyMs: 0, tools: [], keyHint: '', note: 'Provider tùy chỉnh (A2A/MCP).' }) }) },
    stopAll() { commit((d) => { d.runtimes.forEach((r) => { if (r.status === 'connected' && r.id !== 'portal') r.status = 'paused' }); audit(d, 'admin', 'runtime', 'Dừng khẩn cấp mọi runtime sản xuất'); notify(d, 'Đã dừng khẩn cấp mọi runtime sản xuất', '#/admin/agent', { forAdmin: true }) }) },
    saveAgent(cfg: AgentCfg) { commit((d) => { audit(d, 'admin', 'agent', agentDiff(d.agents.find((a) => a.id === cfg.id)!, cfg)); d.agents = d.agents.map((a) => (a.id === cfg.id ? cfg : a)) }) },
    resetSpend() { commit((d) => d.agents.forEach((a) => { a.spentToday = 0 })) },
    approvePlan(code: string, steps: PlanStep[], note: string) {
      commit((d) => {
        const o = order(d, code)
        o.plan = { ...o.plan!, steps, note, status: 'approved', approvedAt: Date.now() }
        audit(d, 'admin', 'plan', `Duyệt kế hoạch ${code}: ${steps.length} bước, ước tính ${vndS(steps.reduce((s, x) => s + x.credit, 0))}`, o.customer)
        o.lastStep = Date.now()
        o.events.push(ev(Date.now(), 'owner', `Chuyên viên đã duyệt kế hoạch ${steps.length} bước${note ? ` — ${note}` : ''}`))
      })
    },

    /* ---- agent bán hàng (khách) ---- */
    startSales() {
      commit((d) => {
        const c = d.customers.find((x) => x.id === d.me)!
        const a = seedSales(d.me, c.name || 'của tôi', 'setup', Date.now(), 0)
        a.knowledge = [{ id: uid(), kind: 'profile', title: 'Giới thiệu', body: `${c.name || 'Doanh nghiệp'} · ${c.industry || 'ngành chưa rõ'}.`, source: 'client', status: 'approved', comments: [], t: Date.now() }]
        a.termsRequested = true; a.handoffTo = c.contact; a.team = [{ id: 'owner', name: c.contact || 'Chủ shop', phone: c.phone, active: true }]
        d.sales = d.sales.filter((x) => x.customer !== d.me).concat(a)
        notify(d, `${c.name} đăng ký agent bán hàng — cần đặt điều khoản`, '#/admin/agent-khach', { forAdmin: true })
      })
    },
    updateSales(patch: Partial<SalesAgent>) { commit((d) => { Object.assign(d.sales.find((x) => x.customer === d.me)!, patch) }) },
    addKnowledge(item: Omit<KItem, 'id' | 't' | 'comments' | 'status' | 'source'>) { commit((d) => { d.sales.find((x) => x.customer === d.me)!.knowledge.unshift({ ...item, id: uid(), t: Date.now(), comments: [], status: 'approved', source: 'client' }) }) },
    editKnowledge(id: string, patch: Partial<KItem>) { commit((d) => { Object.assign(d.sales.find((x) => x.customer === d.me)!.knowledge.find((k) => k.id === id)!, patch) }) },
    removeKnowledge(id: string) { commit((d) => { const a = d.sales.find((x) => x.customer === d.me)!; a.knowledge = a.knowledge.filter((k) => k.id !== id) }) },
    /** Khách trao đổi với agent về một đề xuất; agent cập nhật nội dung theo góp ý và giữ ở trạng thái đề xuất. */
    discussKnowledge(id: string, text: string) {
      commit((d) => {
        const k = d.sales.find((x) => x.customer === d.me)!.knowledge.find((x) => x.id === id)!
        k.comments.push({ from: 'client', text, t: Date.now() })
        const fix = text.match(/(?:sửa|đổi|thành|là)\s*[:"“]?\s*(.+)$/i)?.[1]
        if (fix) k.body = fix.replace(/["”]$/, '')
        k.comments.push({ from: 'ai', t: Date.now() + 1, text: fix ? `Dạ em đã cập nhật nội dung thành: “${k.body}”. Chị xem lại và bấm Duyệt nếu đúng ạ.` : 'Dạ em ghi nhận. Chị cho em nội dung chính xác (ví dụ: "sửa thành …") để em cập nhật nhé.' })
      })
    },
    runResearch() {
      commit((d) => {
        const a = d.sales.find((x) => x.customer === d.me)!
        const c = d.customers.find((x) => x.id === d.me)!
        const props: [KItem['kind'], string, string, string][] = [
          ['faq', 'Bãi đỗ xe', `Theo đánh giá công khai, ${c.name} có chỗ để xe máy, ô tô gửi bãi gần đó.`, 'Google Maps · 128 đánh giá'],
          ['scenario', 'Khách hỏi món cho trẻ em', 'Gợi ý nước ép, sữa chua — khách đánh giá thân thiện với gia đình.', 'Foody · đánh giá gần đây'],
          ['product', 'Giờ cao điểm', 'Khách thường đông 8–9h sáng và 19–21h; nên gợi ý đặt trước.', 'Google Maps · giờ phổ biến'],
        ]
        props.forEach(([kind, title, body, url]) => { if (!a.knowledge.some((k) => k.title === title)) a.knowledge.unshift({ id: uid(), kind, title, body, source: 'research', status: 'proposed', sourceUrl: url, comments: [], t: Date.now() }) })
      })
    },
    runSalesTest() { commit((d) => { const a = d.sales.find((x) => x.customer === d.me)!; a.test = { ...runTest(a.knowledge), at: Date.now() }; if (a.status === 'setup') a.status = 'testing' }) },
    /** Thử chat với agent bán hàng; câu chưa trả lời được trở thành đề xuất kiến thức để khách bổ sung. */
    salesChat(msg: string, history: string[]) {
      return commit((d) => {
        const a = d.sales.find((x) => x.customer === d.me)!
        const r = salesReply(msg, a, history)
        if (r.unknown && !a.knowledge.some((k) => k.title === msg.slice(0, 60))) a.knowledge.unshift({ id: uid(), kind: 'faq', title: msg.slice(0, 60), body: '', source: 'learned', status: 'proposed', comments: [{ from: 'ai', t: Date.now(), text: 'Người mua hỏi câu này nhưng em chưa có câu trả lời. Chị bổ sung nội dung giúp em nhé.' }], t: Date.now() })
        if (r.lead) addLead(d, a, { ...r.lead, channel: 'web', note: 'Từ phòng thử' })
        return r
      })
    },
    connectChannel(id: ChannelId, detail: string) { commit((d) => { const c = d.sales.find((x) => x.customer === d.me)!.channels.find((x) => x.id === id)!; c.connected = true; c.detail = detail; audit(d, 'client', 'sales', `Kết nối kênh ${id}: ${detail}`, d.me) }) },
    disconnectChannel(id: ChannelId) { commit((d) => { const c = d.sales.find((x) => x.customer === d.me)!.channels.find((x) => x.id === id)!; c.connected = false; audit(d, 'client', 'sales', `Ngắt kênh ${id}`, d.me) }) },
    /** Người mua chat qua widget công khai của shop: chỉ kiến thức đã duyệt, không truy cập dữ liệu khác. */
    buyerChat(customer: string, msg: string, history: string[]) {
      return commit((d) => {
        const a = d.sales.find((x) => x.customer === customer)
        if (!a) return { text: 'Dạ shop chưa bật trợ lý trả lời tự động ạ.' }
        const r = salesReply(msg, a, history)
        a.conv += history.length === 1 ? 1 : 0
        if (r.lead) addLead(d, a, { ...r.lead, name: 'Khách website', channel: 'web', note: '' })
        if (r.unknown && !a.knowledge.some((k) => k.title === msg.slice(0, 60))) a.knowledge.unshift({ id: uid(), kind: 'faq', title: msg.slice(0, 60), body: '', source: 'learned', status: 'proposed', comments: [], t: Date.now() })
        return r
      })
    },
    saveTeam(team: NonNullable<SalesAgent['team']>) { commit((d) => { d.sales.find((x) => x.customer === d.me)!.team = team; audit(d, 'client', 'sales', `Cập nhật đội nhận lead: ${team.filter((m) => m.active).map((m) => m.name).join(', ')}`, d.me) }) },
    shopLogin(customer: string, id: string) { commit((d) => { d.session.shop = { customer, id } }) },
    shopLogout() { commit((d) => { d.session.shop = undefined }) },
    shopUpdateLead(id: string, patch: Partial<Lead>) { commit((d) => { const s = d.session.shop!; const a = d.sales.find((x) => x.customer === s.customer)!; const l = a.leads.find((x) => x.id === id)!; Object.assign(l, patch); if (patch.status && patch.status !== 'new') notify(d, `${a.team?.find((m) => m.id === s.id)?.name}: lead ${l.name} → ${patch.status === 'sent' ? 'đã liên hệ' : patch.status === 'won' ? 'chốt được' : 'không thành'}`, '#/app/agent/lead', { customer: s.customer }) }) },
    updateLead(id: string, patch: Partial<Lead>) { commit((d) => { Object.assign(d.sales.find((x) => x.customer === d.me)!.leads.find((l) => l.id === id)!, patch) }) },
    acceptTerms() { commit((d) => { const a = d.sales.find((x) => x.customer === d.me)!; if (a.terms) a.terms.acceptedAt = Date.now(); audit(d, 'client', 'sales', 'Khách chấp nhận điều khoản', d.me); notify(d, `${customerName(d, d.me)} đã chấp nhận điều khoản agent bán hàng`, '#/admin/agent-khach', { forAdmin: true }) }) },
    setSalesStatus(status: SalesAgent['status']) { commit((d) => { const a = d.sales.find((x) => x.customer === d.me)!; a.status = status; a.lastSim = Date.now(); audit(d, 'client', 'sales', status === 'live' ? 'Khách bật chạy thật' : 'Khách tạm dừng agent', d.me) }) },
    adminSetTerms(customer: string, terms: SalesTerms) { commit((d) => { const a = d.sales.find((x) => x.customer === customer)!; a.terms = { ...terms, acceptedAt: undefined }; a.termsRequested = false; audit(d, 'admin', 'sales', `Gửi điều khoản ${vndS(terms.monthly)}/tháng, ${terms.includedConv} hội thoại`, customer); notify(d, 'Studio đã gửi điều khoản agent bán hàng — xem và chấp nhận', '#/app/agent', { customer }) }) },
    adminSetSalesStatus(customer: string, status: SalesAgent['status']) { commit((d) => { d.sales.find((x) => x.customer === customer)!.status = status; audit(d, 'admin', 'sales', `Đặt trạng thái agent bán hàng: ${status}`, customer) }) },

    /* ---- agent xin phép / chi phí / thiếu thông tin ---- */
    decideAction(id: string, ok: boolean) {
      commit((d) => {
        const r = d.actions.find((x) => x.id === id)!, o = order(d, r.orderCode)
        r.status = ok ? 'approved' : 'denied'; r.decidedAt = Date.now(); r.by = d.staff.find((m) => m.id === d.session.member)?.name
        o.events.push(ev(Date.now(), 'owner', ok ? `Cho phép: ${r.action.toLowerCase()}` : `Không cho phép ${r.action.toLowerCase()} — agent bỏ qua bước này`, { internal: true }))
        o.lastStep = 0
        audit(d, 'admin', 'agent', `${ok ? 'Cho phép' : 'Từ chối'} ${r.action} · ${r.orderCode}`, r.customer)
      })
    },
    /** Chạy lại bước hiện tại của agent (ví dụ khi kết quả lệch brief). */
    retryRun(code: string) { commit((d) => { const o = order(d, code); if (o.job !== 'running') return; o.progress = Math.max(6, o.progress - 25); o.lastStep = 0; o.events.push(ev(Date.now(), 'owner', 'Yêu cầu agent chạy lại bước hiện tại', { internal: true })); audit(d, 'admin', 'agent', `Chạy lại ${code}`, o.customer) }) },
    raiseCap(code: string) {
      commit((d) => {
        const o = order(d, code), base = d.agents.find((a) => a.id === findService(o.service)?.agent)?.capJob ?? 100_000
        o.capExtra = (o.capExtra ?? 0) + Math.round(base / 2); o.capHit = false; o.capWarned = false; o.lastStep = 0
        o.events.push(ev(Date.now(), 'owner', `Nới trần chi phí job lên ${vndS(jobCap(d, o))}`, { internal: true }))
        audit(d, 'admin', 'agent', `Nới trần chi phí ${code} lên ${vndS(jobCap(d, o))}`, o.customer)
      })
    },
    answerInput(code: string, text: string, by: 'client' | 'owner' = 'client') {
      commit((d) => {
        const o = order(d, code)
        if (o.job !== 'input_required' || !o.input) return
        o.input.a = text; o.style = `${o.style} ${text}`.trim(); move(o, 'input_answered'); o.lastStep = Date.now()
        o.events.push(ev(Date.now(), by, `Đã trả lời agent: ${text.slice(0, 80)}`))
      })
    },
    reassign(code: string, member: string) { commit((d) => { const o = order(d, code); o.reviewer = member; audit(d, 'admin', 'plan', `Giao duyệt ${code} cho ${d.staff.find((m) => m.id === member)?.name}`, o.customer) }) },

    /* ---- nhân sự (admin) ---- */
    hydrateStaff(members: Member[]) { commit((d) => { const ids = new Set(members.map((member) => member.id)), emails = new Set(members.map((member) => member.email)); d.staff = [...d.staff.filter((member) => !ids.has(member.id) && !emails.has(member.email)), ...members] }) },
    saveMember(m: Member) { commit((d) => { const i = d.staff.findIndex((x) => x.id === m.id || x.email === m.email); if (i >= 0) d.staff[i] = m; else d.staff.push(m); audit(d, 'admin', 'agent', `${i >= 0 ? 'Cập nhật' : 'Mời'} nhân sự ${m.name} · ${ROLE_LABELS[m.role]}${m.active ? '' : ' (khóa)'}`) }) },
    /* ---- hỗ trợ agent bán hàng ---- */
    requestHelp(text: string) { commit((d) => { const a = d.sales.find((x) => x.customer === d.me)!; (a.help ??= []).unshift({ id: uid(), t: Date.now(), text, status: 'open' }); notify(d, `${customerName(d, d.me)} nhờ hỗ trợ agent bán hàng`, `#/admin/agent-khach/${d.me}`, { forAdmin: true }) }) },
    resolveHelp(customer: string, id: string, reply: string) { commit((d) => { const h = d.sales.find((x) => x.customer === customer)!.help!.find((x) => x.id === id)!; h.status = 'done'; h.reply = reply; h.by = d.session.staff === 'admin' ? 'Longca' : 'Thảo'; notify(d, 'Studio đã trả lời yêu cầu hỗ trợ agent', '#/app/agent/dieu-khoan', { customer }); audit(d, 'admin', 'sales', 'Trả lời yêu cầu hỗ trợ', customer) }) },
    /** Chuyên viên soạn kiến thức giúp khách — luôn ở trạng thái đề xuất, khách tự duyệt. */
    staffSuggest(customer: string, item: { kind: KItem['kind']; title: string; body: string }) { commit((d) => { d.sales.find((x) => x.customer === customer)!.knowledge.unshift({ ...item, id: uid(), t: Date.now(), comments: [], status: 'proposed', source: 'studio' }); notify(d, `Studio đề xuất kiến thức mới: ${item.title}`, '#/app/agent/kien-thuc', { customer }); audit(d, 'admin', 'sales', `Đề xuất kiến thức “${item.title}”`, customer) }) },

    readNotifs(admin: boolean) { commit((d) => d.notifs.forEach((n) => { if (admin ? n.forAdmin : !n.forAdmin && !n.provider && n.customer === d.me) n.read = true })) },
    readProviderNotifs() { commit((d) => d.notifs.forEach((n) => { if (n.provider === d.session.provider) n.read = true })) },
    reset(empty = false) { const d = seed(empty); if (!empty) { d.session.admin = ref.current.session.admin; d.session.staff = ref.current.session.staff; d.session.provider = ref.current.session.provider } ref.current = d; setDb(d) },
  }
  return { db, typing, ...actions }
}

type Store = ReturnType<typeof useStoreImpl>
// Kept on globalThis so hot reloads of this module reuse the same context the mounted Provider uses.
const g = globalThis as { __aisStoreCtx?: React.Context<Store | null> }
const Ctx = (g.__aisStoreCtx ??= createContext<Store | null>(null))
export function StoreProvider({ children }: { children: ReactNode }) {
  const s = useStoreImpl()
  return <Ctx.Provider value={s}>{children}</Ctx.Provider>
}
export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore phải được dùng bên trong <StoreProvider>')
  return s
}

export type Mine = ReturnType<typeof useMine>
/** Data scoped to the logged-in customer — client screens must only read through this. */
export function useMine() {
  const { db } = useStore()
  return useMemo(() => {
    const id = db.me
    return {
      customer: db.customers.find((c) => c.id === id)!,
      orders: db.orders.filter((o) => o.customer === id),
      quotes: db.quotes.filter((q) => q.customer === id),
      payments: db.payments.filter((p) => p.customer === id),
      thread: db.threads.find((t) => t.id === id)!,
      notifs: db.notifs.filter((n) => !n.forAdmin && n.customer === id),
      sales: db.sales.find((a) => a.customer === id),
      ledger: db.ledger.filter((l) => l.customer === id),
      credit: creditOf(db, id),
    }
  }, [db])
}
