import { createTransport, http, type EIP1193RequestFn, type Transport } from 'viem'
import { bridgeConnectionError } from '../utils/bridgeErrors'

const READ_METHODS = new Set([
  'eth_chainId', 'eth_blockNumber', 'eth_call', 'eth_getBalance', 'eth_getCode',
  'eth_getTransactionCount', 'eth_estimateGas', 'eth_gasPrice', 'eth_maxPriorityFeePerGas',
  'eth_getBlockByNumber', 'eth_getTransactionReceipt', 'eth_getTransactionByHash',
  'eth_getLogs', 'eth_feeHistory',
])

/** Batch reads to reduce proxy load. Retry one interrupted read, never a broadcast. */
export function createTowerTransport(url: string): Transport<'http'> {
  return options => {
    const config = { timeout: 30_000, retryCount: 0 }
    const reads = http(url, { ...config, batch: { batchSize: 20, wait: 10 } })(options)
    const writes = http(url, config)(options)
    return createTransport({
      ...reads.config,
      key: 'tower', name: 'Tower RPC', retryCount: 0,
      request: (async (args, requestOptions) => {
        const isRead = READ_METHODS.has(args.method)
        const transport = isRead ? reads : writes
        try {
          return await transport.request(args, { ...requestOptions, retryCount: 0 })
        } catch (error) {
          const connection = bridgeConnectionError(error)
          if (!isRead || !connection || requestOptions?.signal?.aborted ||
            (connection.status !== undefined && connection.status !== 429 && connection.status < 500)) throw error
          // A short pause lets a transient upstream error clear.
          await new Promise(resolve => setTimeout(resolve, 400))
          requestOptions?.signal?.throwIfAborted()
          return transport.request(args, { ...requestOptions, retryCount: 0 })
        }
      }) as EIP1193RequestFn,
    }, reads.value)
  }
}
