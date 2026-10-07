/**
 * inter logo - two crossing arrows with a purple→blue gradient.
 * Pass `size` (default 40) to scale the icon uniformly.
 */
interface InterLogoProps {
  size?: number
  className?: string
}

export function InterLogo({ size = 40, className }: InterLogoProps) {
  const id = 'inter-grad'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="inter logo"
    >
      <defs>
        {/* Main purple-to-blue gradient that runs from bottom-left to top-right */}
        <linearGradient id={id} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#A020F0" />
          <stop offset="50%" stopColor="#6644DD" />
          <stop offset="100%" stopColor="#2A7BFF" />
        </linearGradient>
        {/* Soft glow filter */}
        <filter id="inter-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/*
        Two crossing arrows:
          • Arrow 1: top-right  ↗  (from bottom-left to top-right, with arrowhead at top-right)
          • Arrow 2: bottom-left ↙  (from top-right down to bottom-left, with arrowhead at bottom-left)
        Both share the same gradient so the cross feels like one continuous shape.
      */}

      {/* ── Shaft of arrow 1 (↗): thick diagonal stroke */}
      <line
        x1="14" y1="86"
        x2="86" y2="14"
        stroke={`url(#${id})`}
        strokeWidth="17"
        strokeLinecap="round"
        filter="url(#inter-glow)"
      />

      {/* ── Arrowhead of arrow 1: top-right corner ↗ */}
      <polyline
        points="54,14 86,14 86,46"
        stroke={`url(#${id})`}
        strokeWidth="17"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        filter="url(#inter-glow)"
      />

      {/* ── Arrowhead of arrow 2: bottom-left corner ↙ */}
      <polyline
        points="46,86 14,86 14,54"
        stroke={`url(#${id})`}
        strokeWidth="17"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        filter="url(#inter-glow)"
      />
    </svg>
  )
}
