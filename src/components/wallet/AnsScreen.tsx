/**
 * Arc Name Service screen.
 * Name resolution works today via the public ArcNS API.
 * On-chain contracts are deployed on Arc Testnet (chain 5042002).
 * Mainnet deployment is pending an external security audit by the ArcNS team.
 * We surface this clearly so users understand the current scope.
 */
import { useState } from 'react'
import { useWallet } from '../../context/WalletContext'
import { useArcNSPrimaryName } from '../../hooks/useArcNSPrimaryName'
import { useArcNSResolution } from '../../hooks/useArcNSResolution'
import { PageBackground } from '../shared/PageBackground'
import { GlassCard } from '../shared/GlassCard'
import { Skeleton } from '../shared/Skeleton'
import { isArcNSName } from '../../utils/arcns'
import { formatAddress } from '../../utils/wallet'
import {
  Search,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Loader2,
  AtSign,
  Copy,
  Check,
  Info,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

function PrimaryNameCard({ address }: { address: `0x${string}` | undefined }) {
  const { primaryName, isLoading } = useArcNSPrimaryName(address)
  const [copied, setCopied] = useState(false)

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      toast.success('Copied')
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => toast.error('Copy failed'))
  }

  return (
    <GlassCard className="mb-4 p-5">
      <div className="mb-3 flex items-center gap-2">
        <AtSign className="size-4" style={{ color: 'var(--accent)' }} />
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--subtle)' }}>
          Your Name
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-8 w-40" />
      ) : primaryName ? (
        <div>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
              {primaryName}
            </p>
            <CheckCircle className="size-5" style={{ color: 'var(--success)' }} />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <p className="mono text-xs" style={{ color: 'var(--muted)' }}>
              {address ? formatAddress(address) : ''}
            </p>
            <button
              onClick={() => handleCopy(address ?? '')}
              style={{ color: 'var(--subtle)' }}
              aria-label="Copy address"
            >
              {copied
                ? <Check className="size-3" style={{ color: 'var(--success)' }} />
                : <Copy className="size-3" />
              }
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            No primary name set
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
            Register a .arc or .circle name and set it as your primary identity.
          </p>
          <a
            href="https://arcname.services"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={{ background: 'var(--accent-gradient)' }}
          >
            Register a name
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      )}
    </GlassCard>
  )
}

function LookupResult({ input }: { input: string }) {
  const { state } = useArcNSResolution(input)

  if (!isArcNSName(input)) return null

  return (
    <AnimatePresence mode="wait">
      {state.status === 'resolving' && (
        <motion.div
          key="resolving"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="mt-3 flex items-center gap-2 rounded-2xl px-4 py-3"
          style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.14)' }}
        >
          <Loader2 className="size-4 animate-spin" style={{ color: 'var(--accent)' }} />
          <span className="text-sm" style={{ color: 'var(--muted)' }}>Resolving {input}</span>
        </motion.div>
      )}

      {state.status === 'resolved' && (
        <motion.div
          key="resolved"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="mt-3 overflow-hidden rounded-2xl"
          style={{ border: '1px solid rgba(5,150,105,0.20)' }}
        >
          <div className="flex items-center gap-2 px-4 py-3"
            style={{ background: 'rgba(5,150,105,0.06)' }}>
            <CheckCircle className="size-4 shrink-0" style={{ color: 'var(--success)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--success)' }}>
              {state.name} resolved
            </span>
          </div>
          <div className="border-t px-4 py-3"
            style={{ borderColor: 'rgba(5,150,105,0.20)', background: 'var(--surface)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--subtle)' }}>Resolves to</p>
            <p className="mono mt-0.5 break-all text-sm font-medium" style={{ color: 'var(--ink)' }}>
              {state.address}
            </p>
          </div>
        </motion.div>
      )}

      {state.status === 'not_found' && (
        <motion.div
          key="not_found"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="mt-3 flex items-center gap-2 rounded-2xl px-4 py-3"
          style={{ background: 'rgba(18,45,69,0.04)', border: '1px solid rgba(18,45,69,0.10)' }}
        >
          <AlertCircle className="size-4 shrink-0" style={{ color: 'var(--subtle)' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              Name not found
            </p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {input} has no address record set.
            </p>
            <a
              href="https://arcname.services"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold"
              style={{ color: 'var(--accent-hover)' }}
            >
              Register it on ArcNS <ExternalLink className="size-3" />
            </a>
          </div>
        </motion.div>
      )}

      {state.status === 'error' && (
        <motion.div
          key="error"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="mt-3 flex items-center gap-2 rounded-2xl px-4 py-3"
          style={{ background: 'rgba(186,43,76,0.05)', border: '1px solid rgba(186,43,76,0.14)' }}
        >
          <AlertCircle className="size-4 shrink-0" style={{ color: 'var(--danger)' }} />
          <p className="text-xs" style={{ color: 'var(--muted)' }}>{state.hint}</p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function AnsScreen() {
  const { account } = useWallet()
  const address = account?.address
  const [query, setQuery] = useState('')

  return (
    <PageBackground>
      <div className="mx-auto max-w-md px-4 pb-32 pt-5">
        <div className="mb-5">
          <h1 className="display text-xl font-bold" style={{ color: 'var(--ink)' }}>
            Arc Name Service
          </h1>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--subtle)' }}>
            Human-readable .arc and .circle names for Arc addresses
          </p>
        </div>

        {/* Network status banner */}
        <div
          className="mb-4 flex items-start gap-2.5 rounded-2xl p-3.5"
          style={{
            background: 'rgba(234,179,8,0.07)',
            border: '1px solid rgba(234,179,8,0.22)',
          }}
        >
          <Clock className="mt-0.5 size-4 shrink-0" style={{ color: 'rgb(161,118,0)' }} />
          <div>
            <p className="text-xs font-semibold" style={{ color: 'rgb(120,85,0)' }}>
              Mainnet deployment pending
            </p>
            <p className="mt-0.5 text-xs leading-relaxed" style={{ color: 'rgb(161,118,0)' }}>
              ArcNS contracts are currently live on Arc Testnet only. Mainnet deployment is gated on an independent security audit being conducted by the ArcNS team. Name resolution and lookup work today. Names registered now exist on testnet and will need to be re-registered once mainnet launches.
            </p>
          </div>
        </div>

        {/* User's own primary name */}
        <PrimaryNameCard address={address} />

        {/* Name lookup */}
        <GlassCard className="mb-4 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--subtle)' }}>
            Look up a name
          </p>
          <div className="relative">
            <Search
              className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2"
              style={{ color: 'var(--subtle)' }}
            />
            <input
              className="w-full rounded-2xl py-3 pl-10 pr-4 text-sm outline-none placeholder:text-slate-400"
              style={{
                background: 'var(--surface-muted)',
                border: '1px solid var(--border)',
                color: 'var(--ink)',
              }}
              placeholder="generis.arc or generis.circle"
              value={query}
              onChange={(e) => setQuery(e.target.value.trim().toLowerCase())}
              spellCheck={false}
            />
          </div>
          <LookupResult input={query} />
        </GlassCard>

        {/* How it works */}
        <GlassCard className="mb-4">
          <div className="px-4 py-3">
            <div className="flex items-center gap-1.5">
              <Info className="size-3.5" style={{ color: 'var(--subtle)' }} />
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--subtle)' }}>
                How it works
              </p>
            </div>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {[
              {
                step: '1',
                title: 'Register a name',
                body: 'Visit arcname.services and register yourname.arc or yourname.circle. Registration is paid in USDC.',
              },
              {
                step: '2',
                title: 'Point it to your address',
                body: 'Set your inter wallet address as the address record. Anyone can then send assets directly to your name.',
              },
              {
                step: '3',
                title: 'Set it as your primary name',
                body: 'Mark it as your primary name so it appears automatically in wallets and block explorers.',
              },
              {
                step: '4',
                title: 'Receive by name',
                body: 'Share yourname.arc instead of a long hex address. inter resolves it automatically when someone sends to you.',
              },
            ].map(({ step, title, body }) => (
              <div key={step} className="flex gap-3 px-4 py-3.5">
                <div
                  className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: 'var(--accent-gradient)' }}
                >
                  {step}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{title}</p>
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>{body}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* CTA */}
        <GlassCard className="p-4">
          <div className="mb-4 flex gap-2.5 rounded-xl p-3"
            style={{ background: 'rgba(18,45,69,0.04)', border: '1px solid rgba(18,45,69,0.10)' }}>
            <Info className="mt-0.5 size-3.5 shrink-0" style={{ color: 'var(--subtle)' }} />
            <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
              ArcNS is an independent naming protocol built on Arc. inter integrates the public ArcNS resolution API so you can send to names and see your primary name. Registration is managed on the ArcNS website.
            </p>
          </div>
          <a
            href="https://arcname.services"
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={{ background: 'var(--accent-gradient)' }}
          >
            Open ArcNS registrar
            <ExternalLink className="size-4" />
          </a>
        </GlassCard>
      </div>
    </PageBackground>
  )
}
