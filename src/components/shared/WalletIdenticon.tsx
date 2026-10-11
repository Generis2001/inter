/**
 * WalletIdenticon — Deterministic geometric avatar for wallet addresses.
 *
 * Generates abstract, symmetrical geometric patterns inside a rounded-square
 * background. Uses pastel backgrounds with contrasting foreground shapes
 * (dots, bars, curves, rounded rects). Fully deterministic from the wallet
 * address string via a simple hash.
 */

interface WalletIdenticonProps {
  address: string
  size?: number
  className?: string
}

// ---- Colour palettes --------------------------------------------------------
// Each palette: [backgroundPastel, foreground]
const PALETTES = [
  ['#fdd', '#e74c6f'],   // pink
  ['#fef3cd', '#d4a017'], // yellow / gold
  ['#d4fcd4', '#4caf50'], // green
  ['#d4fbfb', '#00bcd4'], // cyan
  ['#d4dbfb', '#5c6bc0'], // blue / indigo
  ['#ead4fb', '#9b59b6'], // purple
  ['#fbd4e8', '#e91e90'], // magenta / hot pink
  ['#e8fbd4', '#8bc34a'], // lime
] as const

// ---- Hash utility -----------------------------------------------------------
// Simple deterministic hash from address string → array of bytes (0–255)
function hashAddress(addr: string | null | undefined): number[] {
  if (!addr || typeof addr !== 'string') return new Array(20).fill(42)
  const norm = addr.toLowerCase().replace(/^0x/, '')
  const bytes: number[] = []
  for (let i = 0; i < norm.length; i += 2) {
    bytes.push(parseInt(norm.slice(i, i + 2), 16) || 0)
  }
  // Stretch to at least 20 bytes by repeating
  while (bytes.length < 20) bytes.push(bytes[bytes.length % Math.max(bytes.length, 1)] ?? 0)
  return bytes
}

// ---- Shape drawing helpers --------------------------------------------------
// Each shape draws a symmetrical element on the left half; we mirror it.

type ShapeDrawer = (ctx: {
  bytes: number[]
  offset: number
  fg: string
  vb: number
}) => string

const shapes: ShapeDrawer[] = [
  // 0: Rounded rect bars (vertical)
  ({ bytes, offset, fg, vb }) => {
    const x = 8 + (bytes[(offset + 0) % bytes.length] % 20)
    const y = 12 + (bytes[(offset + 1) % bytes.length] % 30)
    const w = 6 + (bytes[(offset + 2) % bytes.length] % 10)
    const h = 12 + (bytes[(offset + 3) % bytes.length] % 24)
    const mx = vb - x - w
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2}" fill="${fg}"/>` +
           `<rect x="${mx}" y="${y}" width="${w}" height="${h}" rx="${w / 2}" fill="${fg}"/>`
  },
  // 1: Circles / dots
  ({ bytes, offset, fg, vb }) => {
    const cx = 14 + (bytes[(offset + 0) % bytes.length] % 22)
    const cy = 18 + (bytes[(offset + 1) % bytes.length] % 40)
    const r = 4 + (bytes[(offset + 2) % bytes.length] % 7)
    const mx = vb - cx
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fg}"/>` +
           `<circle cx="${mx}" cy="${cy}" r="${r}" fill="${fg}"/>`
  },
  // 2: Horizontal capsule bar
  ({ bytes, offset, fg, vb }) => {
    const y = 16 + (bytes[(offset + 0) % bytes.length] % 50)
    const h = 6 + (bytes[(offset + 1) % bytes.length] % 6)
    const inset = 12 + (bytes[(offset + 2) % bytes.length] % 14)
    const w = vb - inset * 2
    return `<rect x="${inset}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fg}"/>`
  },
  // 3: Diamond / rotated square
  ({ bytes, offset, fg, vb }) => {
    const cx = 16 + (bytes[(offset + 0) % bytes.length] % 18)
    const cy = 20 + (bytes[(offset + 1) % bytes.length] % 36)
    const s = 5 + (bytes[(offset + 2) % bytes.length] % 7)
    const mx = vb - cx
    return `<rect x="${cx - s}" y="${cy - s}" width="${s * 2}" height="${s * 2}" rx="${s * 0.4}" fill="${fg}" transform="rotate(45 ${cx} ${cy})"/>` +
           `<rect x="${mx - s}" y="${cy - s}" width="${s * 2}" height="${s * 2}" rx="${s * 0.4}" fill="${fg}" transform="rotate(45 ${mx} ${cy})"/>`
  },
  // 4: Curved element (half pill)
  ({ bytes, offset, fg, vb }) => {
    const y = 20 + (bytes[(offset + 0) % bytes.length] % 40)
    const w = 16 + (bytes[(offset + 1) % bytes.length] % 18)
    const h = 8 + (bytes[(offset + 2) % bytes.length] % 10)
    const cx = vb / 2
    return `<rect x="${cx - w / 2}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fg}"/>`
  },
  // 5: Cross / plus shape
  ({ bytes, offset, fg, vb }) => {
    const cx = 16 + (bytes[(offset + 0) % bytes.length] % 18)
    const cy = 20 + (bytes[(offset + 1) % bytes.length] % 38)
    const arm = 4 + (bytes[(offset + 2) % bytes.length] % 6)
    const t = 3 + (bytes[(offset + 3) % bytes.length] % 4)
    const mx = vb - cx
    const make = (x: number) =>
      `<rect x="${x - t / 2}" y="${cy - arm}" width="${t}" height="${arm * 2}" rx="${t / 2}" fill="${fg}"/>` +
      `<rect x="${x - arm}" y="${cy - t / 2}" width="${arm * 2}" height="${t}" rx="${t / 2}" fill="${fg}"/>`
    return make(cx) + make(mx)
  },
]

// ---- Component --------------------------------------------------------------

export function WalletIdenticon({ address, size = 32, className = '' }: WalletIdenticonProps) {
  const safeAddress = typeof address === 'string' && address.length > 0 ? address : '0x0000000000000000000000000000000000000000'
  const bytes = hashAddress(safeAddress)
  const vb = 80 // viewBox size

  // Pick palette
  const paletteIdx = bytes[0] % PALETTES.length
  const [bg, fg] = PALETTES[paletteIdx]

  // Pick 3–4 shapes to draw based on hash bytes
  const numShapes = 3 + (bytes[1] % 2) // 3 or 4
  let svgInner = ''
  for (let i = 0; i < numShapes; i++) {
    const shapeIdx = bytes[2 + i] % shapes.length
    svgInner += shapes[shapeIdx]({ bytes, offset: 4 + i * 4, fg, vb })
  }

  return (
    <svg
      viewBox={`0 0 ${vb} ${vb}`}
      width={size}
      height={size}
      className={className}
      aria-label={`Identicon for ${address.slice(0, 8)}…`}
      style={{ borderRadius: `${size * 0.22}px` }}
    >
      <rect width={vb} height={vb} rx={vb * 0.18} fill={bg} />
      <g dangerouslySetInnerHTML={{ __html: svgInner }} />
    </svg>
  )
}
