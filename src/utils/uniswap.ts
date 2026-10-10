/**
 * Uniswap v4 contract addresses on Arc Mainnet (chain ID 5042)
 * Source: https://developers.uniswap.org/docs/protocols/v4/deployments
 * Verified on-chain 2026-10-10
 */
export const UNISWAP_V4 = {
  POOL_MANAGER:     '0x8366a39CC670B4001A1121B8F6A443A643e40951' as `0x${string}`,
  UNIVERSAL_ROUTER: '0x4fcA4a51Ab4F23A7447b3284fBd7D73289A89Fb1' as `0x${string}`,
  QUOTER:           '0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94' as `0x${string}`,
  STATE_VIEW:       '0xF3334192D15450CdD385c8B70e03f9A6bD9E673b' as `0x${string}`,
  POSITION_MANAGER: '0x6049c9a0e26405C0985f9E3685C87d0aE917f82B' as `0x${string}`,
  PERMIT2:          '0x000000000022D473030F116dDEE9F6B43aC78BA3' as `0x${string}`,
} as const

/**
 * USDC / EURC pool key on Arc mainnet.
 * Both tokens are 6-decimal stablecoins. Currency0 must be the lower address.
 * Pool fee: 500 (0.05%) — the deepest USDC/EURC pool per on-chain data.
 * Tick spacing for 500-fee pools: 10.
 * No hooks on this pool.
 */

// Arc mainnet USDC and EURC addresses (from onchain-facts)
export const USDC_ADDRESS  = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`
export const EURC_ADDRESS  = '0xbEf5f6d51CB62b58e6a8f77868681825c6fe21c1' as `0x${string}`

// Sorted: currency0 is the lower address
const [CURRENCY_0, CURRENCY_1] =
  USDC_ADDRESS.toLowerCase() < EURC_ADDRESS.toLowerCase()
    ? [USDC_ADDRESS, EURC_ADDRESS]
    : [EURC_ADDRESS, USDC_ADDRESS]

export const USDC_EURC_POOL = {
  currency0:   CURRENCY_0,
  currency1:   CURRENCY_1,
  fee:         500,        // 0.05%
  tickSpacing: 10,
  hooks:       '0x0000000000000000000000000000000000000000' as `0x${string}`,
} as const

export type SwapDirection = 'USDC_TO_EURC' | 'EURC_TO_USDC'

/** Quoter v4 ABI — quoteExactInputSingle */
export const QUOTER_ABI = [
  {
    type: 'function',
    name: 'quoteExactInputSingle',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'poolKey', type: 'tuple', components: [
            { name: 'currency0', type: 'address' },
            { name: 'currency1', type: 'address' },
            { name: 'fee',       type: 'uint24'  },
            { name: 'tickSpacing', type: 'int24'  },
            { name: 'hooks',     type: 'address' },
          ]},
          { name: 'zeroForOne',  type: 'bool'    },
          { name: 'exactAmount', type: 'uint128' },
          { name: 'hookData',    type: 'bytes'   },
        ],
      },
    ],
    outputs: [
      { name: 'amountOut',      type: 'uint256' },
      { name: 'gasEstimate',    type: 'uint256' },
    ],
  },
] as const

/**
 * ERC-20 ABI slice — allowance + approve (for Permit2 allowance check)
 */
export const ERC20_ALLOWANCE_ABI = [
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner',   type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount',  type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

/**
 * Universal Router v4 ABI — execute
 * Commands encoding for PERMIT2_PERMIT + V4_SWAP
 */
export const UNIVERSAL_ROUTER_ABI = [
  {
    type: 'function',
    name: 'execute',
    stateMutability: 'payable',
    inputs: [
      { name: 'commands', type: 'bytes'   },
      { name: 'inputs',   type: 'bytes[]' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'execute',
    stateMutability: 'payable',
    inputs: [
      { name: 'commands', type: 'bytes'   },
      { name: 'inputs',   type: 'bytes[]' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

/**
 * Permit2 AllowanceTransfer ABI slice — needed to check allowance for Universal Router
 */
export const PERMIT2_ABI = [
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'user',    type: 'address' },
      { name: 'token',   type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [
      { name: 'amount',     type: 'uint160' },
      { name: 'expiration', type: 'uint48'  },
      { name: 'nonce',      type: 'uint48'  },
    ],
  },
] as const

/**
 * Universal Router command bytes for v4 swaps.
 * 0x10 = V4_SWAP command
 */
export const COMMAND_V4_SWAP = 0x10

/**
 * Actions for the V4Router within the Universal Router.
 * SWAP_EXACT_IN_SINGLE = 0x06
 * SETTLE_ALL           = 0x0c
 * TAKE_ALL             = 0x0f
 */
export const V4_ACTIONS = {
  SWAP_EXACT_IN_SINGLE: 0x06,
  SETTLE_ALL: 0x0c,
  TAKE_ALL: 0x0f,
} as const
