import { useStore, customerName } from '../../store'
import { Btn, when } from '../../ui'

/** Agent dừng lại xin phép trước hành động rủi ro (đăng bài, gửi tin ra ngoài…). */
export default function ActionQueue() {
  const { db, decideAction } = useStore()
  const list = db.actions.filter((a) => a.status === 'pending')
  if (!list.length) return null
  return (
    <section className="grid gap-2">
      <h2 className="text-sm inline-flex items-center gap-2">Agent xin phép <span className="font-mono text-xs text-ink-3">{list.length}</span></h2>
      <ul className="border border-warn/40 rounded-r2 divide-y divide-line">
        {list.map((r) => {
          const ag = db.agents.find((a) => a.id === r.agent)
          return (
            <li key={r.id} className="flex items-center gap-3 p-3.5 max-md:flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium">{ag?.name}: {r.action}</p>
                <p className="text-xs text-ink-3">{r.detail} · <a href={`#/admin/viec/${r.orderCode}`} className="font-mono hover:text-ink">{r.orderCode}</a> · {customerName(db, r.customer)} · {when(r.t)}</p>
              </div>
              <Btn size="s" onClick={() => decideAction(r.id, false)}>Không cho phép</Btn>
              <Btn size="s" kind="primary" onClick={() => decideAction(r.id, true)}>Cho phép</Btn>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
