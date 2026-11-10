/**
 * Official token logos sourced from CoinGecko.
 * USDC: https://coin-images.coingecko.com/coins/images/6319/large/USDC.png
 * EURC: https://coin-images.coingecko.com/coins/images/26045/large/EURC.png
 * cirBTC: https://coin-images.coingecko.com/coins/images/102172745/large/cirbtc.jpg
 */
import cirbtcLogo from '../../assets/cirbtc.jpg'
import type { TokenSymbol } from '../../utils/tokens'

interface TokenLogoProps {
  symbol: TokenSymbol | 'ETH'
  size?: number
  className?: string
}

const LOGO_URLS: Record<string, string> = {
  USDC: 'https://coin-images.coingecko.com/coins/images/6319/large/USDC.png',
  EURC: 'https://coin-images.coingecko.com/coins/images/26045/large/EURC.png',
  cirBTC: cirbtcLogo,
  ETH: 'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png',
}

export function TokenLogo({ symbol, size = 40, className = '' }: TokenLogoProps) {
  const url = LOGO_URLS[symbol]

  return (
    <img
      src={url}
      alt={`${symbol} logo`}
      width={size}
      height={size}
      className={`rounded-full object-cover ${className}`}
      style={{ width: size, height: size, flexShrink: 0 }}
      onError={(e) => {
        // Fallback to a lettered circle if the image fails to load
        const target = e.currentTarget
        target.style.display = 'none'
        const next = target.nextElementSibling as HTMLElement | null
        if (next) next.style.display = 'flex'
      }}
    />
  )
}

/** Fallback lettered circle shown when the image fails */
export function TokenLogoFallback({
  symbol,
  size = 40,
  className = '',
}: TokenLogoProps) {
  const bg = symbol === 'cirBTC' ? '#1c1c1c' : symbol === 'ETH' ? '#627eea' : '#2775CA'
  const label = symbol === 'cirBTC' ? '₿' : symbol === 'ETH' ? 'Ξ' : symbol === 'EURC' ? '€' : '$'

  return (
    <div
      className={`items-center justify-center rounded-full font-bold text-white ${className}`}
      style={{
        width: size,
        height: size,
        background: bg,
        fontSize: size * 0.42,
        display: 'none', // shown only by onError above
        flexShrink: 0,
      }}
    >
      {label}
    </div>
  )
}

/** Renders logo + fallback as a paired unit */
export function TokenIcon({ symbol, size = 40, className = '' }: TokenLogoProps) {
  return (
    <div className={`relative inline-block ${className}`} style={{ width: size, height: size }}>
      <TokenLogo key={symbol} symbol={symbol} size={size} />
      <TokenLogoFallback key={`${symbol}-fallback`} symbol={symbol} size={size} className="absolute inset-0" />
    </div>
  )
}
