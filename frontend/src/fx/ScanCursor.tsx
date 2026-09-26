import { useEffect, useRef, type RefObject } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { isMobileLayout, prefersReducedMotion } from "./motion"
import { publicUrl } from "../api/publicUrl"
import { QrCode } from "../components/QrCode"

gsap.registerPlugin(ScrollTrigger)

export const SAMPLE_TRACKING_REF = "MG1029384756"

export function TrackingQr({ className }: { className?: string }) {
  return (
    <QrCode
      className={className}
      value={publicUrl("/app")}
      label="QR code that opens the XRPL Remit app"
    />
  )
}

function CornerArrow({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" aria-hidden="true">
      <path d="M1.2 8.2V1.2H8.2" fill="none" stroke="currentColor" strokeWidth="1.35" />
      <path d="M1.4 1.4 10 10" fill="none" stroke="currentColor" strokeWidth="1.35" />
    </svg>
  )
}

type ScanCursorProps = {
  sectionRef: RefObject<HTMLElement | null>
}

export function ScanCursor({ sectionRef }: ScanCursorProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const qrLayerRef = useRef<HTMLDivElement>(null)
  const followerRef = useRef<HTMLDivElement>(null)
  const qrFollowRef = useRef<HTMLDivElement>(null)
  const arrowsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    const wrap = wrapRef.current
    const qrLayer = qrLayerRef.current
    const follower = followerRef.current
    const qrFollow = qrFollowRef.current
    if (!section || !wrap || !qrLayer || !follower || !qrFollow) return

    const reduced = prefersReducedMotion()
    const mobile = isMobileLayout()
    if (reduced || mobile) {
      wrap.style.display = "none"
      qrLayer.style.display = "none"
      return
    }

    gsap.set([wrap, qrLayer], { opacity: 0 })
    gsap.set(arrowsRef.current, { opacity: 0 })

    const ease = { duration: 0.42, ease: "power3.out" } as const
    const xCircle = gsap.quickTo(follower, "x", ease)
    const yCircle = gsap.quickTo(follower, "y", ease)
    const xQr = gsap.quickTo(qrFollow, "x", ease)
    const yQr = gsap.quickTo(qrFollow, "y", ease)

    const place = (clientX: number, clientY: number) => {
      const size = follower.offsetWidth || window.innerWidth * 0.22
      const x = clientX - size / 2
      const y = clientY - size / 2
      xCircle(x)
      yCircle(y)
      xQr(x)
      yQr(y)
    }

    const size = follower.offsetWidth || window.innerWidth * 0.22
    const startX = window.innerWidth / 2 - size / 2
    const startY = window.innerHeight / 2 - size / 2
    gsap.set([follower, qrFollow], { x: startX, y: startY })

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top 80%",
      end: "bottom 15%",
      onToggle: (self) => {
        section.classList.toggle("is-scanning", self.isActive)
        gsap.to([wrap, qrLayer], { opacity: self.isActive ? 1 : 0, duration: 0.28, overwrite: true })
        gsap.to(arrowsRef.current, { opacity: self.isActive ? 1 : 0, duration: 0.35, overwrite: true })
      },
    })

    const onMove = (event: PointerEvent) => {
      if (!trigger.isActive) return
      place(event.clientX, event.clientY)
    }
    window.addEventListener("pointermove", onMove)

    return () => {
      window.removeEventListener("pointermove", onMove)
      section.classList.remove("is-scanning")
      trigger.kill()
    }
  }, [sectionRef])

  return (
    <>
      <div ref={wrapRef} className="scan__cursor-wrapper" aria-hidden="true">
        <div ref={followerRef} className="scan__follower">
          <div className="scan__cursor" />
        </div>
      </div>
      <div ref={qrLayerRef} className="scan__qr-layer" aria-hidden="true">
        <div ref={qrFollowRef} className="scan__follower">
          <div className="scan__qrcode-wrapper">
            <TrackingQr className="scan__qrcode" />
            <div ref={arrowsRef} className="scan__arrows-wrapper">
              <CornerArrow className="scan__arrow-ul" />
              <CornerArrow className="scan__arrow-ur" />
              <CornerArrow className="scan__arrow-dl" />
              <CornerArrow className="scan__arrow-dr" />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
