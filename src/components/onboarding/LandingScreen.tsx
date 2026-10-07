import { PageBackground } from '../shared/PageBackground'
import { useWallet } from '../../context/WalletContext'
import { motion } from 'framer-motion'
import { ArrowRight, Shield, Zap, Globe } from 'lucide-react'
import { spectral } from '../shared/GlassCard'
import { InterLogo } from '../shared/InterLogo'

export function LandingScreen() {
  const { startCreateWallet, setScreen } = useWallet()

  return (
    <PageBackground>
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5">
        {/* Hero */}
        <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
          {/* Logo mark */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="mb-8"
          >
            <div
              className="mx-auto mb-4 flex size-20 items-center justify-center rounded-[28px]"
              style={{
                background: 'white',
                boxShadow: '0 12px 48px rgba(6,182,212,0.28)',
              }}
            >
              <InterLogo size={48} />
            </div>
            {/* Accent bar */}
            <div
              className="mx-auto h-1 w-16 rounded-full"
              style={{ background: spectral }}
            />
          </motion.div>

          {/* App name */}
          <motion.h1
            className="mb-3 text-5xl font-extrabold tracking-tight"
            style={{ color: 'var(--ink)', letterSpacing: '-0.04em' }}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
          >
            inter
          </motion.h1>

          <motion.p
            className="mb-1 text-base font-normal"
            style={{ color: 'var(--muted)' }}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Your non-custodial wallet on
          </motion.p>
          <motion.p
            className="mb-10 text-base font-semibold"
            style={{ color: 'var(--accent)' }}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
          >
            Arc - where USDC is the gas
          </motion.p>

          {/* Feature chips */}
          <motion.div
            className="mb-10 w-full space-y-2.5"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {[
              { icon: Shield, label: 'Self-custodial',  sub: 'You control your keys'  },
              { icon: Zap,    label: 'USDC as gas',      sub: 'No ETH needed'          },
              { icon: Globe,  label: 'Arc Network',      sub: 'Sub-second finality'    },
            ].map(({ icon: Icon, label, sub }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-2xl px-4 py-3"
                style={{
                  background: 'rgba(255,255,255,0.68)',
                  border: '1px solid rgba(6,182,212,0.12)',
                }}
              >
                <div
                  className="flex size-9 items-center justify-center rounded-xl"
                  style={{ background: 'rgba(6,182,212,0.10)' }}
                >
                  <Icon className="size-4" style={{ color: 'var(--accent-light)' }} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                    {label}
                  </p>
                  <p className="support-text" style={{ color: 'var(--subtle)' }}>
                    {sub}
                  </p>
                </div>
              </div>
            ))}
          </motion.div>

          {/* CTAs */}
          <motion.div
            className="w-full space-y-3"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.38 }}
          >
            <button
              onClick={startCreateWallet}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{ background: 'var(--accent-gradient)' }}
            >
              Create New Wallet
              <ArrowRight className="size-4" />
            </button>
            <button
              onClick={() => setScreen('import-wallet')}
              className="w-full rounded-2xl py-4 text-sm font-semibold transition-all active:scale-[0.99]"
              style={{
                background: 'rgba(255,255,255,0.68)',
                border: '1px solid rgba(6,182,212,0.18)',
                color: 'var(--ink)',
              }}
            >
              Import Existing Wallet
            </button>
          </motion.div>
        </div>

        {/* Footer */}
        <p className="pb-8 text-center support-text" style={{ color: 'var(--subtle)' }}>
          Your keys, your crypto. inter never stores your private keys.
        </p>
      </div>
    </PageBackground>
  )
}
