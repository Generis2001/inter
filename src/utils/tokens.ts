/**
 * Arc Mainnet token registry.
 * Import token facts from here - never hard-code addresses or decimals inline.
 */

export interface TokenInfo {
  symbol: 'USDC' | 'EURC'
  name: string
  address: `0x${string}`
  decimals: number
  /** Currency sign for display */
  sign: string
  /** ISO currency code */
  currency: string
}

export const ARC_MAINNET_ID = 5042

export const TOKENS: TokenInfo[] = [
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x3600000000000000000000000000000000000000',
    decimals: 6,
    sign: '$',
    currency: 'USD',
  },
  {
    symbol: 'EURC',
    name: 'Euro Coin',
    address: '0xbEf5f6d51CB62b58e6a8f77868681825c6fe21c1',
    decimals: 6,
    sign: '€',
    currency: 'EUR',
  },
]

export const TOKEN_BY_SYMBOL: Record<string, TokenInfo> = Object.fromEntries(
  TOKENS.map((t) => [t.symbol, t]),
)

export const TOKEN_BY_ADDRESS: Record<string, TokenInfo> = Object.fromEntries(
  TOKENS.map((t) => [t.address.toLowerCase(), t]),
)

export function getToken(symbol: string): TokenInfo | undefined {
  return TOKEN_BY_SYMBOL[symbol]
}

export function getTokenByAddress(address: string): TokenInfo | undefined {
  return TOKEN_BY_ADDRESS[address.toLowerCase()]
}
