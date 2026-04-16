import React from 'react'

interface AppLogoProps {
  size?: number
  className?: string
  style?: React.CSSProperties
}

/**
 * Inline SVG version of the Berean logo.
 * Matches build/icon.svg — open book with gold beacon above the spine.
 */
export default function AppLogo({ size = 24, className, style }: AppLogoProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {/* Background rounded square */}
      <rect width="512" height="512" rx="110" fill="#1E3358" />

      {/* Left page */}
      <path
        d="M256 172C248 172 200 174 152 192L148 358C196 342 246 342 256 344Z"
        fill="white"
        opacity="0.95"
      />

      {/* Right page (slightly darker — shadow side) */}
      <path
        d="M256 172C264 172 312 174 360 192L364 358C316 342 266 342 256 344Z"
        fill="white"
        opacity="0.72"
      />

      {/* Book bottom edge in gold */}
      <path
        d="M148 358C196 342 246 342 256 344C266 342 316 342 364 358L364 365C316 349 266 349 256 351C246 349 196 349 148 365Z"
        fill="#C8932A"
        opacity="0.45"
      />

      {/* Spine */}
      <line x1="256" y1="172" x2="256" y2="344" stroke="#D4A853" strokeWidth="4.5" strokeLinecap="round" />

      {/* Text lines — left page */}
      <line x1="172" y1="225" x2="244" y2="219" stroke="#8AA3BE" strokeWidth="9" strokeLinecap="round" opacity="0.45" />
      <line x1="172" y1="251" x2="244" y2="246" stroke="#8AA3BE" strokeWidth="9" strokeLinecap="round" opacity="0.45" />
      <line x1="172" y1="277" x2="244" y2="273" stroke="#8AA3BE" strokeWidth="9" strokeLinecap="round" opacity="0.45" />
      <line x1="172" y1="303" x2="224" y2="300" stroke="#8AA3BE" strokeWidth="9" strokeLinecap="round" opacity="0.45" />

      {/* Text lines — right page */}
      <line x1="268" y1="219" x2="340" y2="225" stroke="#7A92A8" strokeWidth="9" strokeLinecap="round" opacity="0.30" />
      <line x1="268" y1="246" x2="340" y2="251" stroke="#7A92A8" strokeWidth="9" strokeLinecap="round" opacity="0.30" />
      <line x1="268" y1="273" x2="340" y2="277" stroke="#7A92A8" strokeWidth="9" strokeLinecap="round" opacity="0.30" />

      {/* Beacon glow (outer halo) */}
      <circle cx="256" cy="112" r="28" fill="#D4A853" opacity="0.14" />
      {/* Beacon mid */}
      <circle cx="256" cy="112" r="18" fill="#D4A853" opacity="0.32" />
      {/* Beacon core */}
      <circle cx="256" cy="112" r="11" fill="#D4A853" opacity="0.8" />
      {/* Beacon highlight */}
      <circle cx="252" cy="108" r="4" fill="#FFF0B0" opacity="0.75" />

      {/* Light ray connecting beacon to spine */}
      <line x1="256" y1="123" x2="256" y2="172" stroke="#D4A853" strokeWidth="3" strokeLinecap="round" opacity="0.45" />
    </svg>
  )
}
