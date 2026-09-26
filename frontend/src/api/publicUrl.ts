// Absolute link a phone can open. VITE_PUBLIC_URL overrides the browser origin,
// e.g. a laptop's LAN address, since a phone cannot reach localhost.
export function publicUrl(path: string): string {
  const base = import.meta.env.VITE_PUBLIC_URL || window.location.origin
  return `${base.replace(/\/+$/, "")}${path}`
}

export function trackingUrl(trackingRef: string): string {
  return publicUrl(`/app/track/${encodeURIComponent(trackingRef)}`)
}
