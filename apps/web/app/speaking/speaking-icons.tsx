type IconProps = { className?: string }

const iconProps = {
  'aria-hidden': true,
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  strokeWidth: 1.8,
  viewBox: '0 0 24 24',
}

export function MicrophoneIcon({ className = 'size-6' }: IconProps) {
  return (
    <svg {...iconProps} className={className}>
      <rect x="8" y="3" width="8" height="12" rx="4" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
    </svg>
  )
}

export function HeadphonesIcon({ className = 'size-6' }: IconProps) {
  return (
    <svg {...iconProps} className={className}>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <path d="M4 14a2 2 0 0 1 2-2h1v7H6a2 2 0 0 1-2-2v-3ZM20 14a2 2 0 0 0-2-2h-1v7h1a2 2 0 0 0 2-2v-3Z" />
    </svg>
  )
}

export function PlayIcon({ className = 'size-6' }: IconProps) {
  return (
    <svg {...iconProps} className={className}>
      <path d="m9 6 9 6-9 6V6Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function StopIcon({ className = 'size-6' }: IconProps) {
  return (
    <svg {...iconProps} className={className}>
      <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" />
    </svg>
  )
}

export function CheckIcon({ className = 'size-6' }: IconProps) {
  return (
    <svg {...iconProps} className={className}>
      <path d="m5 12 4 4L19 6" />
    </svg>
  )
}

export function HistoryIcon({ className = 'size-6' }: IconProps) {
  return (
    <svg {...iconProps} className={className}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </svg>
  )
}

export function ShieldIcon({ className = 'size-6' }: IconProps) {
  return (
    <svg {...iconProps} className={className}>
      <path d="M12 3 5 6v5c0 4.6 2.8 8.2 7 10 4.2-1.8 7-5.4 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export function UploadIcon({ className = 'size-6' }: IconProps) {
  return (
    <svg {...iconProps} className={className}>
      <path d="M12 16V4m0 0L7 9m5-5 5 5M5 15v4h14v-4" />
    </svg>
  )
}

export function Spinner({ className = 'size-5' }: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={`${className} inline-block animate-spin rounded-full border-2 border-current border-l-transparent motion-reduce:animate-none`}
    />
  )
}
