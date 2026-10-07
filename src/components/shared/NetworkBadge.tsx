import { requireChain } from '@/onchain-facts'
import { Wifi, WifiOff } from 'lucide-react'

const ARC_MAINNET_ID = 5042

interface NetworkBadgeProps {
  isConnected?: boolean
}

export function NetworkBadge({ isConnected = true }: NetworkBadgeProps) {
  const chain = requireChain(ARC_MAINNET_ID)

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1"
      style={{
        background: isConnected ? 'rgba(6,182,212,0.10)' : 'rgba(220,38,38,0.10)',
        border: `1px solid ${isConnected ? 'rgba(6,182,212,0.30)' : 'rgba(220,38,38,0.30)'}`,
      }}
    >
      {isConnected ? (
        <Wifi className="size-3" style={{ color: 'var(--accent-light)' }} />
      ) : (
        <WifiOff className="size-3" style={{ color: 'var(--danger)' }} />
      )}
      <span
        className="text-xs font-semibold"
        style={{ color: isConnected ? 'var(--accent)' : 'var(--danger)' }}
      >
        {chain.name}
      </span>
    </div>
  )
}
