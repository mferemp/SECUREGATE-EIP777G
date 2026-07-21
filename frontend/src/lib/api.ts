export function api(path: string): string {
  const clean = String(path || '').replace(/^\/+/, '')
  return `/api/${clean}`
}
