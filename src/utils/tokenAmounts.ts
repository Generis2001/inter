import { Amount } from '../onchain-money'
import type { TokenInfo } from './tokens'

/** Preserve satoshis for cirBTC and micro-units for small stablecoin balances. */
export function formatTokenBalance(amount: Amount, token: Pick<TokenInfo, 'symbol' | 'decimals'>): string {
  const precision = token.symbol === 'cirBTC' || (amount.raw > 0n && amount.raw < 10n ** BigInt(token.decimals - 2))
    ? token.decimals : 2
  return amount.toFixed(precision)
}
