export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function isMobileLayout(): boolean {
  return window.matchMedia("(max-width: 767px)").matches
}
