import type { SVGProps } from "react"

function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9a1 1 0 0 0 1 1H10v-5.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V20h3.5a1 1 0 0 0 1-1v-9" />
    </Icon>
  )
}

export function ProfileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M4.8 20c1-3.6 4-5.6 7.2-5.6s6.2 2 7.2 5.6" />
    </Icon>
  )
}

export function KycIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 5 6v5.2c0 4.4 3 7.9 7 9.3 4-1.4 7-4.9 7-9.3V6z" />
      <path d="m9 12 2 2 4-4.2" />
    </Icon>
  )
}

export function BeneficiariesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8.2" r="2.8" />
      <path d="M3.3 19c.8-2.9 3-4.6 5.7-4.6s4.9 1.7 5.7 4.6" />
      <circle cx="17.3" cy="8.6" r="2.2" />
      <path d="M15.5 14.6c2.3.2 4 1.8 4.6 4.1" />
    </Icon>
  )
}

export function SendIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M20.5 3.5 3 10.2l6.6 2.7L12.5 20l8-16.5Z" />
      <path d="M9.6 12.9 20.5 3.5" />
    </Icon>
  )
}

export function HistoryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5" />
      <path d="M3 4v4h4" />
      <path d="M12 8.5V12l2.6 1.6" />
    </Icon>
  )
}

export function WalletIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="6.5" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
      <path d="M16 14.2h2.2" />
    </Icon>
  )
}

export function CashOutIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M12 15.6V17M12 7v1.4" />
    </Icon>
  )
}

export function AdminKycIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="5.5" y="4" width="13" height="17" rx="1.6" />
      <path d="M9 3.5h6v2H9z" />
      <path d="m9 12.5 2 2 4-4.5" />
    </Icon>
  )
}

export function CashInIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 4h16v13H8l-4 4z" />
      <path d="M12 7.5v5M9.3 10.2 12 12.8l2.7-2.6" />
    </Icon>
  )
}

export function SettlementIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 7h13l-2.8-2.8" />
      <path d="M20 17H7l2.8 2.8" />
    </Icon>
  )
}

export function CashOutsQueueIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 6h16M4 12h10M4 18h7" />
      <path d="m17 15 3 3-3 3" />
    </Icon>
  )
}

export function ConfigIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="2.8" />
      <path d="M12 3.5v2.3M12 18.2v2.3M4.9 6.5l1.9 1.3M17.2 16.2l1.9 1.3M3.5 12h2.3M18.2 12h2.3M4.9 17.5l1.9-1.3M17.2 7.8l1.9-1.3" />
    </Icon>
  )
}

export function PlatformWalletIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3.5 9.5 12 4l8.5 5.5" />
      <path d="M5 9.5v9M9.3 9.5v9M14.7 9.5v9M19 9.5v9" />
      <path d="M3.5 18.5h17" />
    </Icon>
  )
}

export function BaobabLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" {...props}>
      <path d="M20.5 58 C16.5 47 18 37.5 25.5 30.5 L38.5 30.5 C46 37.5 47.5 47 43.5 58 Z" fill="currentColor"/>
      <path d="M27 32 C24 26.5 20.5 23 14 20 M30.5 31 C29.5 25 27.5 20 26 15.5 M33.5 31 C34.5 25 36.5 20 38 15.5 M37 32 C40 26.5 43.5 23 50 20" stroke="currentColor" strokeWidth="4.2" strokeLinecap="round" fill="none"/>
      <path d="M14 20 L8.5 18.5 M14 20 L12.5 14.5 M50 20 L55.5 18.5 M50 20 L51.5 14.5 M26 15.5 L21.5 12 M38 15.5 L42.5 12" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" fill="none"/>
      <ellipse cx="8" cy="16.5" rx="5.5" ry="2.6" fill="currentColor"/>
      <ellipse cx="14.5" cy="12" rx="5" ry="2.4" fill="currentColor"/>
      <ellipse cx="23" cy="10" rx="5.2" ry="2.5" fill="currentColor"/>
      <ellipse cx="32" cy="12.5" rx="4.2" ry="2.2" fill="currentColor"/>
      <ellipse cx="41" cy="10" rx="5.2" ry="2.5" fill="currentColor"/>
      <ellipse cx="49.5" cy="12" rx="5" ry="2.4" fill="currentColor"/>
      <ellipse cx="56" cy="16.5" rx="5.5" ry="2.6" fill="currentColor"/>
      <path d="M13 59.5 H51" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
    </svg>
  )
}
