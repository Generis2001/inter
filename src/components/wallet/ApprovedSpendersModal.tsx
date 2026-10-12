/**
 * ApprovedSpendersModal — Token Allowance & Spender Management.
 * Lists active allowances on Arc Mainnet with one-click revocation.
 */
import { useState, useEffect, useCallback } from 'react'
import { BottomSheet } from '../shared/BottomSheet'
import { TokenIcon } from '../shared/TokenLogo'
import { useWallet } from '../../context/WalletContext'
import {
  fetchActiveAllowances,
  revokeAllowance,
  type ActiveAllowance,
} from '../../utils/allowances'
import { useRequireTxPin } from '../../utils/securitySettings'
import { PinVerificationModal } from '../shared/PinVerificationModal'
import { buildTxExplorerUrl } from '@/onchain-facts'
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  ExternalLink,
  Trash2,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

const ARC_MAINNET_ID = 5042

interface ApprovedSpendersModalProps {
  open: boolean
  onClose: () => void
}

export function ApprovedSpendersModal({ open, onClose }: ApprovedSpendersModalProps) {
  const { account } = useWallet()
  const [requirePin] = useRequireTxPin()
  const [allowances, setAllowances] = useState<ActiveAllowance[]>([])
  const [loading, setLoading] = useState(false)
  const [revokingAddress, setRevokingAddress] = useState<string | null>(null)
  const [pendingRevokeItem, setPendingRevokeItem] = useState<ActiveAllowance | null>(null)
  const [pinModalOpen, setPinModalOpen] = useState(false)

  const loadAllowances = useCallback(async () => {
    if (!account?.address) return
    setLoading(true)
    try {
      const active = await fetchActiveAllowances(account.address)
      setAllowances(active)
    } catch {
      toast.error('Failed to load token allowances')
    } finally {
      setLoading(false)
    }
  }, [account])

  /* oxlint-disable react/set-state-in-effect */
  useEffect(() => {
    if (open) {
      void loadAllowances()
    }
  }, [open, loadAllowances])
  /* oxlint-enable react/set-state-in-effect */

  const executeRevoke = async (item: ActiveAllowance) => {
    if (!account) return
    setRevokingAddress(`${item.tokenAddress}_${item.spenderAddress}`)
    try {
      await revokeAllowance(
        account,
        item.tokenAddress,
        item.spenderAddress,
        item.spenderName,
        item.tokenSymbol,
      )
      toast.success(`Revoked allowance for ${item.spenderName}`)
      void loadAllowances()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to revoke allowance'
      toast.error(msg)
    } finally {
      setRevokingAddress(null)
    }
  }

  const handleRevokeClick = (item: ActiveAllowance) => {
    if (requirePin) {
      setPendingRevokeItem(item)
      setPinModalOpen(true)
    } else {
      void executeRevoke(item)
    }
  }

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title="Approved Spenders">
        <div className="px-4 pb-8 pt-2">
          {/* Header intro */}
          <div
            className="mb-4 flex items-start justify-between rounded-2xl p-3.5"
            style={{
              background: 'rgba(6,182,212,0.06)',
              border: '1px solid rgba(6,182,212,0.18)',
            }}
          >
            <div className="flex gap-2.5">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--accent)' }} />
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Active ERC-20 allowances granted to DEX routers and protocols. Revoking an approval resets permission to 0.
              </p>
            </div>
            <button
              onClick={() => { void loadAllowances() }}
              disabled={loading}
              className="ml-2 flex size-7 shrink-0 items-center justify-center rounded-lg transition-all hover:bg-black/5 disabled:opacity-40"
              style={{ color: 'var(--ink)' }}
              title="Refresh allowances"
            >
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* List or Empty State */}
          {loading && allowances.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Loader2 className="mb-3 size-7 animate-spin" style={{ color: 'var(--accent)' }} />
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Scanning on-chain token allowances...
              </p>
            </div>
          ) : allowances.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div
                className="mb-3 flex size-14 items-center justify-center rounded-2xl"
                style={{
                  background: 'rgba(26,128,71,0.10)',
                  border: '1px solid rgba(26,128,71,0.20)',
                }}
              >
                <ShieldCheck className="size-7" style={{ color: 'var(--success)' }} />
              </div>
              <h4 className="display text-base font-bold" style={{ color: 'var(--ink)' }}>
                No Active Allowances
              </h4>
              <p className="mt-1 max-w-xs text-xs" style={{ color: 'var(--muted)' }}>
                No contracts currently have access to withdraw your tokens. Your wallet is secure.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {allowances.map((item) => {
                  const itemKey = `${item.tokenAddress}_${item.spenderAddress}`
                  const isRevoking = revokingAddress === itemKey

                  return (
                    <motion.div
                      key={itemKey}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="rounded-2xl p-3.5 transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.70)',
                        border: '1px solid rgba(18,45,69,0.10)',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <TokenIcon symbol={item.tokenSymbol} size={32} />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold" style={{ color: 'var(--ink)' }}>
                                {item.spenderName}
                              </span>
                              {item.isUnlimited ? (
                                <span
                                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                                  style={{
                                    background: 'rgba(234,179,8,0.15)',
                                    color: '#b45309',
                                    border: '1px solid rgba(234,179,8,0.30)',
                                  }}
                                >
                                  <ShieldAlert className="size-2.5" /> Unlimited
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                                  style={{
                                    background: 'rgba(6,182,212,0.12)',
                                    color: 'var(--accent)',
                                  }}
                                >
                                  Exact ({item.allowanceFormatted})
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5">
                              <span className="mono text-[11px]" style={{ color: 'var(--subtle)' }}>
                                {item.spenderAddress.slice(0, 6)}...{item.spenderAddress.slice(-4)}
                              </span>
                              <a
                                href={buildTxExplorerUrl(ARC_MAINNET_ID, item.spenderAddress)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="transition-opacity hover:opacity-75"
                                style={{ color: 'var(--accent)' }}
                                title="View contract on explorer"
                              >
                                <ExternalLink className="size-2.5" />
                              </a>
                            </div>
                          </div>
                        </div>

                        {/* Revoke button */}
                        <button
                          onClick={() => handleRevokeClick(item)}
                          disabled={isRevoking}
                          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 transition-all hover:bg-rose-50 active:scale-95 disabled:opacity-40"
                          style={{
                            background: 'rgba(186,43,76,0.08)',
                            border: '1px solid rgba(186,43,76,0.20)',
                          }}
                        >
                          {isRevoking ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" />
                              Revoking...
                            </>
                          ) : (
                            <>
                              <Trash2 className="size-3.5" />
                              Revoke
                            </>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </BottomSheet>

      {/* PIN Verification Modal when PIN is enabled */}
      <PinVerificationModal
        open={pinModalOpen}
        onClose={() => {
          setPinModalOpen(false)
          setPendingRevokeItem(null)
        }}
        onSuccess={() => {
          if (pendingRevokeItem) {
            void executeRevoke(pendingRevokeItem)
          }
        }}
        title="Authorize Revoke"
        description="Enter your 6-digit PIN to authorize revoking this token allowance."
        actionLabel="Authorize Revoke"
      />
    </>
  )
}
