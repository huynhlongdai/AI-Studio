// Adapter runtime chung: OpenClaw trước, Hermes/custom sau — cùng một giao diện để store không phụ thuộc runtime cụ thể.
// Bản thử nghiệm: không gọi mạng. Bản thật gọi A2A (Agent Card, tasks/send, tasks/get, tasks/cancel) hoặc MCP qua server,
// khóa truy cập nằm ở kho bí mật phía server, không bao giờ ở trình duyệt.
import type { Runtime } from './agents'

export interface AgentCard { name: string; protocol: 'a2a' | 'mcp'; tools: string[]; streaming: boolean }
export interface Health { ok: boolean; latencyMs: number; checkedAt: number }
export interface RunRequest { taskId: string; agent: string; brief: Record<string, unknown>; tools: string[]; costCap: number }
export interface RunHandle { runId: string; runtime: string; startedAt: number }
export interface RuntimeAdapter {
  kind: Runtime['kind']
  /** Đọc năng lực runtime (Agent Card A2A hoặc tools/list MCP). */
  discover(endpoint: string): AgentCard
  health(r: Runtime): Health
  dispatch(r: Runtime, req: RunRequest): RunHandle
  kill(r: Runtime, runId: string): void
}

const CARDS: Record<Runtime['kind'], AgentCard> = {
  openclaw: { name: 'OpenClaw gateway', protocol: 'a2a', streaming: true, tools: ['canva.autofill', 'figma.write', 'seedance.generate', 'wordpress.deploy', 'browser.research', 'files.upload', 'gbrain.search'] },
  hermes: { name: 'Hermes Agent', protocol: 'a2a', streaming: true, tools: ['browser.research', 'files.upload', 'terminal.exec'] },
  custom: { name: 'Provider tùy chỉnh', protocol: 'mcp', streaming: false, tools: ['files.upload'] },
}

function mock(kind: Runtime['kind'], base: number): RuntimeAdapter {
  return {
    kind,
    discover: () => CARDS[kind],
    health: (r) => ({ ok: r.status === 'connected', latencyMs: r.status === 'connected' ? base + Math.round(Math.random() * 120) : 0, checkedAt: Date.now() }),
    dispatch: (r, req) => ({ runId: `${r.id}:${req.taskId}:${Date.now().toString(36)}`, runtime: r.id, startedAt: Date.now() }),
    kill: () => undefined,
  }
}

export const ADAPTERS: Record<Runtime['kind'], RuntimeAdapter> = { openclaw: mock('openclaw', 140), hermes: mock('hermes', 200), custom: mock('custom', 60) }
export const adapterFor = (r: Runtime) => ADAPTERS[r.kind]
