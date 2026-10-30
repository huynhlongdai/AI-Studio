import { useEffect, useState } from 'react'

/** Hash router: "#/app/don-hang/AIS-2610-014/ban-nhap" → ["app","don-hang","AIS-2610-014","ban-nhap"] */
const parse = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)

export function useRoute() {
  const [parts, setParts] = useState(parse)
  useEffect(() => {
    const on = () => { setParts(parse()); window.scrollTo(0, 0) }
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return parts
}

export const navigate = (path: string) => { location.hash = path.startsWith('#') ? path : '#' + path }
