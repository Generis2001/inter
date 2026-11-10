import { FileCode, Route, ShieldCheck } from 'lucide-react'
import type { ArcTransaction } from '../../utils/transactionHistory'
import { transactionKind } from '../../utils/transactionPresentation'
import { TokenIcon } from './TokenLogo'
import { TowerLogo } from './TowerLogo'
import { getToken } from '../../utils/tokens'

export function TransactionIcon({ tx, size = 32 }: { tx: ArcTransaction; size?: number }) {
  const kind = transactionKind(tx)
  const token = getToken(tx.tokenSymbol)
  if ((kind === 'transfer' || kind === 'bridge') && token) return <div className="relative shrink-0">
    <TokenIcon symbol={token.symbol} size={size} />
    {kind === 'bridge' && <span className="absolute -bottom-1 -right-1 rounded-full p-0.5" style={{ background: 'var(--surface)', color: 'var(--accent)' }}><Route className="size-3" /></span>}
  </div>
  if (kind === 'swap' && /tower/i.test(tx.contractName ?? '')) return <TowerLogo size={size - 4} />
  if (kind === 'approval') return <ShieldCheck className="size-5" style={{ color: 'var(--accent)' }} />
  return <FileCode className="size-5" style={{ color: 'var(--accent)' }} />
}
