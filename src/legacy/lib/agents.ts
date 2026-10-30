// Lớp Agent: runtime (OpenClaw…), cấu hình & quyền từng agent, kế hoạch của agent điều phối, agent bán hàng thuê dài hạn.
import type { ServiceCode } from './catalog'

export type Tier = 'fast' | 'standard' | 'pro'
export const TIERS: Record<Tier, { label: string; models: string[]; costPer1k: number; use: string }> = {
  fast: { label: 'Nhanh', models: ['Qwen3.7 Flash', 'DeepSeek V4 Flash', 'Haiku 5.5'], costPer1k: 8, use: 'Phân loại, tóm tắt, chat đơn giản' },
  standard: { label: 'Chuẩn', models: ['Sonnet 5.5', 'GPT-6 Sol', 'Qwen3.7 Max'], costPer1k: 60, use: 'Viết, thiết kế, dựng trang' },
  pro: { label: 'Chuyên sâu', models: ['Opus 5.5'], costPer1k: 300, use: 'Lập kế hoạch khó, xử lý khi QC trượt' },
}

export interface Runtime {
  id: string; name: string; kind: 'openclaw' | 'hermes' | 'custom'; endpoint: string
  status: 'connected' | 'disconnected' | 'paused'; lastBeat: number; latencyMs: number; tools: string[]; keyHint: string; note: string
}
export type AgentId = 'intake' | 'orchestrator' | 'mai' | 'khoa' | 'minh' | 'lan' | 'research' | 'sales'
export type DataScope = 'brief' | 'brief_profile' | 'workspace'
export const RISKY_ACTIONS = ['Đăng bài lên kênh của khách', 'Gửi email cho khách', 'Gửi tin nhắn ra ngoài nền tảng', 'Tạo giao dịch thanh toán', 'Xóa tệp'] as const
export interface AgentCfg {
  id: AgentId; name: string; role: string; runtime: string; tier: Tier; autoEscalate: boolean
  tools: string[]; data: DataScope; capJob: number; capDay: number; spentToday: number; approval: string[]; enabled: boolean; customerFacing: boolean
}

export interface PlanStep { id: string; title: string; agent: AgentId; tier: Tier; credit: number }
export interface Plan { status: 'pending' | 'approved'; steps: PlanStep[]; note?: string; createdAt: number; approvedAt?: number }

/** Agent điều phối: chia việc theo dịch vụ. Chỉ dịch vụ nhiều bước mới cần cổng duyệt kế hoạch. */
export const NEEDS_PLAN: ServiceCode[] = ['landing']
export function proposePlan(service: ServiceCode, style: string, uid: () => string): PlanStep[] {
  const s = (title: string, agent: AgentId, tier: Tier, credit: number): PlanStep => ({ id: uid(), title, agent, tier, credit })
  if (service === 'landing') return [
    s(`Research đối thủ & từ khóa cho "${style.slice(0, 40)}"`, 'research', 'fast', 18_000),
    s('Dựng sơ đồ nội dung và dàn ý từng khối', 'orchestrator', 'pro', 45_000),
    s('Viết nội dung tiếng Việt, tối ưu chuyển đổi', 'minh', 'standard', 38_000),
    s('Thiết kế giao diện điện thoại trước, dựng trên Flatsome', 'minh', 'standard', 64_000),
    s('Gắn form, kiểm tra tốc độ và hiển thị', 'lan', 'fast', 12_000),
  ]
  return []
}

/* ---------------- Agent bán hàng ---------------- */
export type KKind = 'profile' | 'product' | 'faq' | 'scenario' | 'limit'
export const KKIND: Record<KKind, string> = { profile: 'Doanh nghiệp', product: 'Sản phẩm', faq: 'Câu hỏi thường gặp', scenario: 'Tình huống', limit: 'Giới hạn' }
export interface KComment { from: 'client' | 'ai'; text: string; t: number }
export interface KItem {
  id: string; kind: KKind; title: string; body: string; source: 'client' | 'research' | 'learned' | 'studio'
  status: 'approved' | 'proposed' | 'rejected'; sourceUrl?: string; comments: KComment[]; t: number
}
export type ChannelId = 'web' | 'zalo' | 'messenger' | 'instagram' | 'telegram' | 'api'
export const CHANNELS: Record<ChannelId, { name: string; how: string; field: string }> = {
  web: { name: 'Widget website', how: 'Dán 1 dòng mã vào website', field: 'Tên miền' },
  zalo: { name: 'Zalo OA', how: 'Ủy quyền Zalo Official Account', field: 'ID Official Account' },
  messenger: { name: 'Messenger', how: 'Kết nối Fanpage Facebook', field: 'Tên Fanpage' },
  instagram: { name: 'Instagram', how: 'Kết nối tài khoản doanh nghiệp', field: 'Tên tài khoản' },
  telegram: { name: 'Telegram', how: 'Dán token bot từ BotFather', field: 'Tên bot' },
  api: { name: 'API / Webhook', how: 'Gọi API từ hệ thống của bạn (CRM, app)', field: 'Webhook URL nhận lead' },
}
export interface Channel { id: ChannelId; connected: boolean; detail: string; conv: number }
export interface Lead {
  id: string; t: number; name: string; phone: string; need: string; product: string; budget: string
  heat: 'hot' | 'warm' | 'cold'; summary: string; next: string; status: 'new' | 'sent' | 'won' | 'lost'; channel: ChannelId; note: string
  /** Thời điểm người mua đồng ý cho lưu SĐT; nhân viên shop được giao. */
  consentAt?: number; assignee?: string
}
/** Nhân viên của khách nhận lead (gọi lại người mua). */
export interface ShopStaff { id: string; name: string; phone: string; active: boolean }
export interface SalesTerms { monthly: number; includedConv: number; extraPerConv: number; leadFee: number; note: string; acceptedAt?: number }
export interface SalesAgent {
  customer: string; name: string; tone: string; status: 'setup' | 'testing' | 'live' | 'paused'
  knowledge: KItem[]; channels: Channel[]; leads: Lead[]; handoffTo: string; maxDiscountPct: number
  test: { score: number; total: number; at: number } | null; terms: SalesTerms | null; termsRequested: boolean
  conv: number; createdAt: number; lastSim: number
  help?: HelpReq[]; team?: ShopStaff[]
}
/** Khách nhờ chuyên viên hỗ trợ thiết lập agent. */
export interface HelpReq { id: string; t: number; text: string; status: 'open' | 'done'; reply?: string; by?: string }

/** Bộ chấm thi thử: các câu người mua hay hỏi; đạt khi kiến thức đã duyệt trả lời được. */
export const TEST_QUESTIONS = ['Giờ mở cửa thế nào?', 'Có giao hàng không?', 'Giá bao nhiêu?', 'Sản phẩm nào bán chạy?', 'Có giảm giá không?', 'Đổi trả thế nào?', 'Địa chỉ ở đâu?', 'Có xuất hóa đơn không?']

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
const words = (s: string) => norm(s).split(/[^a-z0-9]+/).filter((w) => w.length > 2)
const STOP = new Set(['khong', 'nhieu', 'bao', 'nao', 'the', 'co', 'cho', 'minh', 'shop', 'ban', 'gi', 'nhu'])

export function bestAnswer(q: string, items: KItem[]): KItem | null {
  const qs = new Set(words(q).filter((w) => !STOP.has(w)))
  let best: KItem | null = null, score = 0
  for (const k of items) {
    if (k.status !== 'approved') continue
    const ks = words(k.title + ' ' + k.body)
    const s = ks.filter((w) => qs.has(w)).length + (words(k.title).some((w) => qs.has(w)) ? 1 : 0)
    if (s > score) { score = s; best = k }
  }
  return score >= 1 ? best : null
}
export const runTest = (items: KItem[]) => ({ score: TEST_QUESTIONS.filter((q) => bestAnswer(q, items)).length, total: TEST_QUESTIONS.length })

const PHONE = /(0|\+84)\d{9}/
export interface SalesReply { text: string; lead?: Omit<Lead, 'id' | 't' | 'status' | 'channel' | 'note'>; unknown?: boolean; askPhone?: boolean; askConsent?: boolean }
/** Trả lời theo kiến thức đã duyệt; không bịa; xin đồng ý trước khi nhận SĐT; tạo thẻ lead khi có SĐT. */
export function salesReply(msg: string, a: SalesAgent, history: string[]): SalesReply {
  const m = msg.trim()
  const findPhone = (x: string) => x.replace(/[\s.]/g, '').match(PHONE)?.[0]
  const YES = /^(dạ |vâng |ok |oke |)?(đồng ý|ok|oke|được|vâng|có|ừ|dạ được|dạ có)(?=[\s.,!]|$)/i
  let phone = findPhone(m)
  const earlier = history.slice(0, -1).map(findPhone).filter(Boolean).pop()
  // Xin đồng ý trước khi lưu số: số chưa kèm "đồng ý" thì hỏi lại; câu "đồng ý" sau đó mới tạo lead.
  if (phone && !/đồng ý/i.test(m)) return { askConsent: true, text: `Dạ em xin phép lưu số ${phone} để ${a.handoffTo || 'nhân viên'} gọi tư vấn riêng đơn này, không dùng cho quảng cáo. Mình đồng ý không ạ?` }
  if (!phone && earlier && YES.test(m)) phone = earlier
  if (!phone && earlier && /^(không|thôi|ko|k)(?=[\s.,!]|$)/i.test(m)) return { text: 'Dạ em không lưu số ạ. Mình cứ hỏi tiếp, em trả lời ngay tại đây nhé.' }
  if (phone) {
    const ctx = history.join(' ')
    const prod = a.knowledge.find((k) => k.kind === 'product' && k.status === 'approved' && norm(ctx).includes(norm(k.title).split(' ')[0]))
    return {
      text: `Dạ em cảm ơn ạ. Em đã chuyển thông tin cho ${a.handoffTo || 'nhân viên tư vấn'} — bạn ấy sẽ gọi lại cho mình trong khoảng 15 phút. Mình cần hỏi thêm gì cứ nhắn em nhé.`,
      lead: {
        name: 'Khách từ hội thoại thử', phone, need: history.slice(-3).join(' · ').slice(0, 120) || 'Cần tư vấn', product: prod?.title ?? 'Chưa rõ',
        budget: /tr|triệu|k\b|nghìn/i.test(ctx) ? ctx.match(/\d+\s*(tr|triệu|k|nghìn)/i)?.[0] ?? 'Chưa rõ' : 'Chưa rõ',
        heat: /đặt|mua|lấy|chốt|gấp/i.test(ctx) ? 'hot' : 'warm', summary: `Khách hỏi: ${history.slice(-4).join(' / ').slice(0, 200)}`, next: 'Gọi lại xác nhận nhu cầu và chốt đơn', consentAt: Date.now(),
      },
    }
  }
  if (/gọi|điện thoại|số đt|sđt|tư vấn trực tiếp|gặp nhân viên|đặt số lượng|mua sỉ/i.test(m)) {
    return { askPhone: true, text: `Dạ để ${a.handoffTo || 'nhân viên'} tư vấn kỹ hơn, mình cho em xin số điện thoại nhé. Số này chỉ dùng để liên hệ tư vấn đơn này ạ.` }
  }
  if (/giảm|khuyến mãi|bớt|discount/i.test(m)) {
    const k = bestAnswer(m, a.knowledge)
    return { text: k ? k.body : a.maxDiscountPct > 0 ? `Dạ hiện em hỗ trợ được tối đa ${a.maxDiscountPct}% cho đơn này ạ.` : 'Dạ hiện shop chưa có chương trình giảm giá ạ.' }
  }
  const k = bestAnswer(m, a.knowledge)
  if (k) return { text: k.body }
  return { unknown: true, text: 'Dạ câu này em chưa có thông tin chính xác, em ghi lại để shop bổ sung. Mình để lại số điện thoại để nhân viên trả lời giúp nhé?' }
}

/** Ngưỡng thi thử để được bật chạy thật. */
export const PASS_RATE = 0.8
export const canGoLive = (a: SalesAgent) => !!a.test && a.test.score / a.test.total >= PASS_RATE && a.channels.some((c) => c.connected) && !!a.terms?.acceptedAt
