export function safeNextPath(value: string | null | undefined) {
  if (!value || value !== value.trim()) return '/'
  if (!value.startsWith('/') || value.startsWith('//')) return '/'

  let decoded = value
  try {
    decoded = decodeURIComponent(value)
  } catch {
    return '/'
  }
  if (decoded.includes('\\') || decoded.startsWith('//')) return '/'

  try {
    const base = new URL('http://athena.local')
    const destination = new URL(value, base)
    if (destination.origin !== base.origin) return '/'
    if (
      destination.pathname === '/auth' ||
      destination.pathname.startsWith('/auth/')
    ) {
      return '/'
    }
    return `${destination.pathname}${destination.search}${destination.hash}`
  } catch {
    return '/'
  }
}

export function authPathFor(nextPath: string) {
  const safe = safeNextPath(nextPath)
  return safe === '/' ? '/auth' : `/auth?next=${encodeURIComponent(safe)}`
}
