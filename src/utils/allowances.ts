/**
 * Token Allowance & Approved Spenders management utility.
 * Allows viewing active ERC-20 token allowances and revoking permissions.
 */
import { createPublicClient, createWalletClient, http, type CustomTransport } from 'viem'
import { getBridgeChain } from './bridgeChains'
import { requireChain } from '../onchain-facts'
import { getTokenByAddress, getTokens } from './tokens'
import { recordTransaction } from '../hooks/useArcTransactions'
import { Amount } from '@/onchain-money'

export const ERC20_ALLOWANCE_ABI = [
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const

export interface KnownSpender {
  chainId: number
  tokenAddress: `0x${string}`
  tokenSymbol: string
  spenderAddress: `0x${string}`
  spenderName: string
  lastUpdated: number
}

export interface ActiveAllowance {
  chainId: number
  tokenAddress: `0x${string}`
  tokenSymbol: string
  tokenDecimals: number
  spenderAddress: `0x${string}`
  spenderName: string
  allowanceRaw: bigint
  allowanceFormatted: string
  isUnlimited: boolean
}

// Built-in Arc protocol spenders
const DEFAULT_SPENDERS: { address: `0x${string}`; name: string }[] = [
  {
    address: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    name: 'Uniswap v4 Permit2',
  },
  {
    address: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
    name: 'Universal Router',
  },
  {
    address: '0x5d9b544b6f12534a6efc0082c50dc576885dfb06',
    name: 'Tower DEX Router',
  },
]

function getSpendersStorageKey(walletAddress: string): string {
  return `inter_known_spenders_v2_${walletAddress.toLowerCase()}`
}

export function recordKnownSpender(
  walletAddress: string,
  entry: {
    tokenAddress: `0x${string}`
    tokenSymbol: string
    spenderAddress: `0x${string}`
    spenderName: string
    chainId?: number
  },
): void {
  try {
    const key = getSpendersStorageKey(walletAddress)
    const list = getRecordedSpenders(walletAddress)

    const index = list.findIndex(
      (item) =>
        item.chainId === (entry.chainId ?? 5042) &&
        item.tokenAddress.toLowerCase() === entry.tokenAddress.toLowerCase() &&
        item.spenderAddress.toLowerCase() === entry.spenderAddress.toLowerCase(),
    )

    const updatedItem: KnownSpender = {
      chainId: entry.chainId ?? 5042,
      tokenAddress: entry.tokenAddress.toLowerCase() as `0x${string}`,
      tokenSymbol: entry.tokenSymbol,
      spenderAddress: entry.spenderAddress.toLowerCase() as `0x${string}`,
      spenderName: entry.spenderName,
      lastUpdated: Date.now(),
    }

    if (index >= 0) {
      list[index] = updatedItem
    } else {
      list.push(updatedItem)
    }

    localStorage.setItem(key, JSON.stringify(list))
    window.dispatchEvent(new CustomEvent('inter_allowances_updated'))
  } catch {}
}

export function getRecordedSpenders(walletAddress: string): KnownSpender[] {
  try {
    const key = getSpendersStorageKey(walletAddress)
    const existingRaw = localStorage.getItem(key)
    const current = (existingRaw ? JSON.parse(existingRaw) : []) as KnownSpender[]
    const legacy = JSON.parse(localStorage.getItem(`inter_known_spenders_${walletAddress.toLowerCase()}`) ?? '[]') as KnownSpender[]
    return [...current, ...legacy.map(row => ({ ...row, chainId: row.chainId ?? 5042 }))]
  } catch {
    return []
  }
}

/**
 * Reads all active allowances (allowance > 0) across all known spenders and tokens on Arc.
 */
export async function fetchActiveAllowances(
  walletAddress: `0x${string}`,
  chainId = 5042,
): Promise<ActiveAllowance[]> {
  const recorded = getRecordedSpenders(walletAddress)

  // Combine default spenders with recorded ones
  const candidates: {
    chainId: number
    tokenAddress: `0x${string}`
    tokenSymbol: string
    tokenDecimals: number
    spenderAddress: `0x${string}`
    spenderName: string
  }[] = []

  const seen = new Set<string>()

  // 1. Check all tokens against default spenders
  for (const token of getTokens(chainId)) {
    for (const def of DEFAULT_SPENDERS) {
      const key = `${chainId}_${token.address.toLowerCase()}_${def.address.toLowerCase()}`
      if (!seen.has(key)) {
        seen.add(key)
        candidates.push({
          chainId,
          tokenAddress: token.address,
          tokenSymbol: token.symbol,
          tokenDecimals: token.decimals,
          spenderAddress: def.address,
          spenderName: def.name,
        })
      }
    }
  }

  // 2. Check recorded spenders
  for (const rec of recorded) {
    if (requireChain(rec.chainId).isTestnet !== requireChain(chainId).isTestnet) continue
    const key = `${rec.chainId}_${rec.tokenAddress.toLowerCase()}_${rec.spenderAddress.toLowerCase()}`
    if (!seen.has(key)) {
      seen.add(key)
      const token = getTokenByAddress(rec.tokenAddress)
      candidates.push({
        chainId: rec.chainId,
        tokenAddress: rec.tokenAddress,
        tokenSymbol: rec.tokenSymbol || token?.symbol || 'TOKEN',
        tokenDecimals: token?.decimals ?? 6,
        spenderAddress: rec.spenderAddress,
        spenderName: rec.spenderName || 'DEX Router',
      })
    }
  }

  const results: ActiveAllowance[] = []

  await Promise.all(
    candidates.map(async (cand) => {
      try {
        const publicClient = createPublicClient({ chain: getBridgeChain(cand.chainId).chain, transport: http() })
        const allowance = await publicClient.readContract({
          address: cand.tokenAddress,
          abi: ERC20_ALLOWANCE_ABI,
          functionName: 'allowance',
          args: [walletAddress, cand.spenderAddress],
        })

        if (allowance > 0n) {
          // Large allowances (>= 10^24) count as Unlimited
          const isUnlimited = allowance >= 10n ** 24n
          const formatted = isUnlimited
            ? 'Unlimited'
            : `${Amount.fromRaw(allowance, cand.tokenDecimals).toFixed(tokenDecimalsForDisplay(cand.tokenSymbol, cand.tokenDecimals))} ${cand.tokenSymbol}`

          results.push({
            chainId: cand.chainId,
            tokenAddress: cand.tokenAddress,
            tokenSymbol: cand.tokenSymbol,
            tokenDecimals: cand.tokenDecimals,
            spenderAddress: cand.spenderAddress,
            spenderName: cand.spenderName,
            allowanceRaw: allowance,
            allowanceFormatted: formatted,
            isUnlimited,
          })
        }
      } catch {
        // Skip failed reads
      }
    }),
  )

  return results
}

function tokenDecimalsForDisplay(symbol: string, decimals: number): number {
  return symbol.toLowerCase() === 'cirbtc' ? decimals : 2
}

/**
 * Revokes an allowance by setting it to 0 on-chain.
 */
export async function revokeAllowance(
  account: { address: `0x${string}` },
  tokenAddress: `0x${string}`,
  spenderAddress: `0x${string}`,
  spenderName: string,
  tokenSymbol: string,
  chainId = 5042,
): Promise<`0x${string}`> {
  type ViemAccount = Parameters<typeof createWalletClient>[0] extends { account?: infer A }
    ? NonNullable<A>
    : never
  const viemAcct = account as unknown as ViemAccount

  const chain = getBridgeChain(chainId).chain
  const publicClient = createPublicClient({ chain, transport: http() })
  const walletClient = createWalletClient({
    account: viemAcct,
    chain,
    transport: http() as unknown as CustomTransport,
  })

  const hash = await walletClient.writeContract({
    account: viemAcct,
    address: tokenAddress,
    abi: ERC20_ALLOWANCE_ABI,
    functionName: 'approve',
    args: [spenderAddress, 0n],
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error('Allowance revocation reverted.')

  // Record revoke in transaction history
  recordTransaction({
    hash,
    from: account.address.toLowerCase() as `0x${string}`,
    to: tokenAddress.toLowerCase() as `0x${string}`,
    value: '0.00',
    rawValue: 0n,
    tokenSymbol,
    timestamp: Date.now(),
    status: 'success',
    direction: 'contract',
    blockNumber: null,
    gasUsed: '0',
    contractName: spenderName,
    method: 'Revoke Approval',
    txType: 'approval',
  }, chainId)

  window.dispatchEvent(new CustomEvent('inter_allowances_updated'))
  return hash
}
