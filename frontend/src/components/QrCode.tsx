import { useMemo } from "react"
import qrcode from "qrcode-generator"
import { trackingUrl } from "../api/publicUrl"

const QUIET_ZONE = 2

interface QrCodeProps {
  value: string
  label: string
  className?: string
}

export function QrCode({ value, label, className }: QrCodeProps) {
  const path = useMemo(() => {
    const qr = qrcode(0, "M")
    qr.addData(value)
    qr.make()
    const count = qr.getModuleCount()
    let d = ""
    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        if (qr.isDark(row, col)) d += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`
      }
    }
    return { d, size: count + QUIET_ZONE * 2 }
  }, [value])

  return (
    <svg
      className={className}
      viewBox={`0 0 ${path.size} ${path.size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <title>{label}</title>
      <rect width={path.size} height={path.size} fill="#ffffff" />
      <path d={path.d} fill="#151515" />
    </svg>
  )
}

export function TrackQrCard({ trackingRef }: { trackingRef: string }) {
  const url = trackingUrl(trackingRef)
  return (
    <div className="qr-share">
      <QrCode className="qr-share__code" value={url} label={`QR code for tracking ${trackingRef}`} />
      <div className="qr-share__text">
        <h3>Scan to follow this transfer</h3>
        <p className="muted">
          Opens the track page for <span className="mono">{trackingRef}</span> on a phone. The
          sender, the linked recipient or an admin can view it after signing in.
        </p>
        <p className="hint mono">{url}</p>
      </div>
    </div>
  )
}
