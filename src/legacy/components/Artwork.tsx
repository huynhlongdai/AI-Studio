import type { ServiceCode } from '../lib/catalog'

/** Placeholder previews standing in for real deliverables, one per service. `v` changes details between versions. */
export function Artwork({ service, brand, v, variant = 0, small = false }: { service: ServiceCode; brand: string; v: number; variant?: number; small?: boolean }) {
  const ink = '#3f2e22', mute = '#8a7564'
  const name = brand.toUpperCase().slice(0, 14)
  const cls = small ? 'w-full h-full' : 'w-full h-full max-h-[420px]'
  if (service === 'logo') {
    const w = v >= 2 ? 2.2 : 1.4
    return (
      <svg viewBox="0 0 240 160" className={`${cls} ${variant === 1 ? 'grayscale contrast-150' : ''}`} aria-label={`Logo ${brand} v${v}`}>
        {variant === 2 ? (
          <g fill="none" stroke={ink} strokeWidth={w * 1.6} strokeLinecap="round"><circle cx="120" cy="80" r="44" /><path d="M120 116V56c15 9 20 20 17 35" /></g>
        ) : (
          <>
            <g fill="none" stroke={ink} strokeWidth={w} strokeLinecap="round">
              <circle cx="120" cy="58" r="30" /><path d="M120 82V40c10 6 14 14 12 24" />
              {v < 2 && <path d="M120 60c-9-4-13-11-11-19" />}
            </g>
            <text x="120" y="122" textAnchor="middle" fontFamily="Georgia, serif" fontSize="20" fontWeight={v >= 2 ? 600 : 400} fill={ink} letterSpacing="3">{name}</text>
            <text x="120" y="140" textAnchor="middle" fontFamily="Geist, sans-serif" fontSize="8" fill={mute} letterSpacing="4">EST. 2026</text>
          </>
        )}
      </svg>
    )
  }
  if (service === 'post') {
    const tones = ['#e9dccb', '#cdb79e', '#3f2e22', '#f4efe8', '#b9875c', '#e2d4c0']
    return (
      <svg viewBox="0 0 240 160" className={cls} aria-label={`Bộ post ${brand} v${v}`}>
        {tones.map((c, i) => {
          const x = 30 + (i % 3) * 62, y = 18 + Math.floor(i / 3) * 64
          return (
            <g key={i}>
              <rect x={x} y={y} width="56" height="56" rx="3" fill={c} />
              <rect x={x + 8} y={y + 36} width={v >= 2 ? 30 : 38} height="4" rx="1" fill={i === 2 ? '#f4efe8' : ink} opacity=".8" />
              <rect x={x + 8} y={y + 44} width="22" height="3" rx="1" fill={i === 2 ? '#f4efe8' : mute} opacity=".7" />
              <circle cx={x + 40} cy={y + 18} r={v >= 2 ? 8 : 10} fill={i === 2 ? '#b9875c' : '#fff'} opacity=".7" />
            </g>
          )
        })}
      </svg>
    )
  }
  if (service === 'video') {
    return (
      <svg viewBox="0 0 240 160" className={cls} aria-label={`Video ${brand} v${v}`}>
        <rect x="88" y="10" width="64" height="140" rx="6" fill="#2a211b" />
        <rect x="92" y="14" width="56" height="100" rx="3" fill="#b9875c" />
        <circle cx="120" cy="62" r={v >= 2 ? 20 : 16} fill="#e9dccb" opacity=".6" />
        <path d="M114 54v16l13-8z" fill="#fff" />
        <rect x="98" y="122" width="44" height="4" rx="2" fill="#f4efe8" opacity=".85" />
        <rect x="104" y="130" width="32" height="3" rx="1.5" fill="#f4efe8" opacity=".5" />
        <rect x="92" y="142" width="56" height="2" fill="#5c4a3d" /><rect x="92" y="142" width={v >= 2 ? 34 : 20} height="2" fill="#fff" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 240 160" className={cls} aria-label={`Landing page ${brand} v${v}`}>
      <rect x="30" y="12" width="180" height="136" rx="5" fill="#fff" stroke="#e2d9cd" />
      <rect x="30" y="12" width="180" height="12" rx="5" fill="#f4efe8" />
      {[38, 44, 50].map((x) => <circle key={x} cx={x} cy="18" r="2" fill="#d4c6b4" />)}
      <rect x="40" y="32" width="160" height="50" rx="3" fill="#cdb79e" />
      <text x="50" y="56" fontFamily="Georgia, serif" fontSize="12" fill={ink}>{brand.slice(0, 18)}</text>
      <rect x="50" y="64" width="40" height="9" rx="2" fill={v >= 2 ? ink : '#5e5ce6'} />
      {[0, 1, 2].map((i) => <rect key={i} x={40 + i * 55} y="92" width="50" height="36" rx="3" fill="#f4efe8" />)}
      <rect x="40" y="134" width="70" height="4" rx="2" fill="#e2d9cd" />
    </svg>
  )
}
