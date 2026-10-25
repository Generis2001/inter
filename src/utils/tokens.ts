/**
 * Arc token registry for Arc Mainnet and Arc Testnet.
 * Import token facts from here — never hard-code addresses or decimals inline.
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
export const ARC_TESTNET_ID = 5042002

export const USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as const
export const EURC_MAINNET_ADDRESS = '0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1' as const
export const EURC_TESTNET_ADDRESS = '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a' as const

export const TOKENS: TokenInfo[] = [
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: USDC_ADDRESS,
    decimals: 6,
    sign: '$',
    currency: 'USD',
  },
  {
    symbol: 'EURC',
    name: 'Euro Coin',
    address: EURC_MAINNET_ADDRESS,
    decimals: 6,
    sign: '€',
    currency: 'EUR',
  },
]

export function getTokenAddress(symbol: 'USDC' | 'EURC', chainId?: number): `0x${string}` {
  if (symbol === 'USDC') return USDC_ADDRESS
  return chainId === ARC_TESTNET_ID ? EURC_TESTNET_ADDRESS : EURC_MAINNET_ADDRESS
}

export function getTokens(chainId?: number): TokenInfo[] {
  return [
    TOKENS[0],
    {
      ...TOKENS[1],
      address: getTokenAddress('EURC', chainId),
    },
  ]
}

export const TOKEN_BY_SYMBOL: Record<string, TokenInfo> = Object.fromEntries(
  TOKENS.map((t) => [t.symbol, t]),
)

export const TOKEN_BY_ADDRESS: Record<string, TokenInfo> = {
  ...Object.fromEntries(TOKENS.map((t) => [t.address.toLowerCase(), t])),
  [EURC_TESTNET_ADDRESS.toLowerCase()]: {
    ...TOKENS[1],
    address: EURC_TESTNET_ADDRESS,
  },
}

export function getToken(symbol: string): TokenInfo | undefined {
  return TOKEN_BY_SYMBOL[symbol]
}

export function getTokenByAddress(address: string): TokenInfo | undefined {
  return TOKEN_BY_ADDRESS[address.toLowerCase()]
}
