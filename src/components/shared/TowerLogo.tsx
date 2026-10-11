/**
 * TowerLogo — Official Tower Exchange castle mark.
 * Extracted directly from https://www.tower.exchange/assets/towerlogo.svg
 * (the icon/glyph portion only, no wordmark, no dark background).
 */

interface TowerLogoProps {
  size?: number
  className?: string
}

export function TowerLogo({ size = 16, className = '' }: TowerLogoProps) {
  return (
    <svg
      viewBox="0 0 36 36"
      width={size}
      height={size}
      className={className}
      aria-label="Tower Exchange"
      fill="none"
    >
      {/* Official Tower Exchange glyph — blue castle icon */}
      <path
        d="M18 0C27.9409 0.000123878 36 8.07081 36 18.0117C36 27.6451 28.4318 35.5217 18.917 36V15.3281L8.75293 19.1426V33.4648C3.50972 30.3153 0 24.5714 0 18.0117C2.26793e-05 8.07073 8.05901 0 18 0ZM22.6777 21.8564V27.8193H25.0771V21.8564L23.8066 20.0137L22.6777 21.8564ZM15.7412 5.36914V10.5225L14.0469 11.124V6.42871L10.8701 7.48828V12.252L8.96484 12.9287V8.33594L5.78809 9.39551V18.5078L18.918 13.6338V9.39551H18.917V4.30957L15.7412 5.36914ZM29.9355 7.27637C29.9355 7.10684 27.3946 8.7598 26.124 9.60742V12.1504L29.9355 13.8457V7.27637ZM24.4229 6.01367C24.419 5.88515 22.1636 7.16096 21.0352 7.81543V9.78027L24.4229 11.0908V6.01367Z"
        fill="#7BB8FF"
      />
      <path
        d="M13.0001 21.8558L14.1295 20.0132L15.4001 21.8558V27.8183H13.0001V21.8558Z"
        fill="#7AB8FE"
      />
    </svg>
  )
}
