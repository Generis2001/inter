/**
 * TowerLogo — SVG icon of the Tower Exchange castle mark.
 * Extracted from the official brand asset; dark background removed.
 * Use inline wherever the "Tower" / "Tower Exchange" label appears.
 */

interface TowerLogoProps {
  size?: number
  className?: string
}

export function TowerLogo({ size = 16, className = '' }: TowerLogoProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-label="Tower Exchange"
      fill="none"
    >
      {/* Blue circle background */}
      <circle cx="50" cy="50" r="48" fill="#5BB8F5" />
      {/* Castle / tower silhouette cut-out */}
      <g fill="#1a1a2e">
        {/* Left tower */}
        <rect x="22" y="18" width="12" height="52" rx="1" />
        {/* Right tower */}
        <rect x="40" y="24" width="26" height="46" rx="1" />
        {/* Bridge / connecting wall */}
        <rect x="22" y="36" width="44" height="8" rx="1" />
        {/* Battlements - left tower */}
        <rect x="20" y="14" width="6" height="10" rx="1" />
        <rect x="30" y="14" width="6" height="10" rx="1" />
        {/* Battlements - right section */}
        <rect x="40" y="18" width="6" height="10" rx="1" />
        <rect x="50" y="18" width="6" height="10" rx="1" />
        <rect x="60" y="18" width="6" height="10" rx="1" />
        {/* Heart-shaped windows on right tower */}
        <ellipse cx="49" cy="30" rx="3" ry="3.5" fill="#5BB8F5" />
        <ellipse cx="57" cy="30" rx="3" ry="3.5" fill="#5BB8F5" />
        {/* Arched doorways */}
        <path d="M25 54 C25 48, 31 48, 31 54 L31 70 L25 70 Z" fill="#5BB8F5" />
        <path d="M47 54 C47 48, 53 48, 53 54 L53 70 L47 70 Z" fill="#5BB8F5" />
        {/* Narrow left window */}
        <path d="M24 44 C24 40, 27 40, 27 44 L27 50 L24 50 Z" fill="#5BB8F5" />
      </g>
    </svg>
  )
}
