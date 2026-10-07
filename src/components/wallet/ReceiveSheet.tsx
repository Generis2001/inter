import { useState, useEffect, useRef } from 'react'
import { useWallet } from '../../context/WalletContext'
import { BottomSheet } from '../shared/BottomSheet'
import { TokenIcon } from '../shared/TokenLogo'
import { TOKENS, type TokenInfo } from '../../utils/tokens'
import { Copy, Check, Share2, AlertTriangle, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import QRCode from 'qrcode'

interface ReceiveSheetProps {
  open: boolean
  onClose: () => void
}

export function ReceiveSheet({ open, onClose }: ReceiveSheetProps) {
  const { account } = useWallet()
  const address = account?.address ?? ''
  const [copied, setCopied] = useState(false)
  const [selectedToken, setSelectedToken] = useState<TokenInfo>(TOKENS[0])
  const [showPicker, setShowPicker] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || !address || !open) return
    QRCode.toCanvas(canvasRef.current, address, {
      width: 220,
      margin: 2,
      color: { dark: '#122d45', light: '#ffffff' },
    }).catch(() => {/* silent */})
  }, [address, open])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      toast.success('Address copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Copy failed')
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `My Arc ${selectedToken.symbol} Address`, text: address })
      } catch {
        // User cancelled
      }
    } else {
      await handleCopy()
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Receive">
      {/* Token selector */}
      <div className="mb-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--subtle)' }}>
          Select Asset
        </p>
        <div className="relative">
          <button
            onClick={() => setShowPicker((v) => !v)}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 transition-all hover:bg-black/4"
            style={{
              background: 'rgba(255,255,255,0.70)',
              border: '1px solid rgba(18,45,69,0.12)',
            }}
          >
            <TokenIcon symbol={selectedToken.symbol} size={28} />
            <div className="flex-1 text-left">
              <p className="text-sm font-bold" style={{ color: 'var(--ink)' }}>
                {selectedToken.symbol}
              </p>
              <p className="text-xs" style={{ color: 'var(--subtle)' }}>
                {selectedToken.name}
              </p>
            </div>
            <ChevronDown className="size-4" style={{ color: 'var(--subtle)' }} />
          </button>

          <AnimatePresence>
            {showPicker && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute left-0 top-full z-50 mt-1.5 w-full overflow-hidden rounded-2xl shadow-xl"
                style={{
                  background: 'rgba(255,255,255,0.96)',
                  border: '1px solid rgba(18,45,69,0.12)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                {TOKENS.map((t) => (
                  <button
                    key={t.symbol}
                    onClick={() => { setSelectedToken(t); setShowPicker(false) }}
                    className="flex w-full items-center gap-3 px-4 py-3 transition-all hover:bg-black/5"
                    style={{
                      background: t.symbol === selectedToken.symbol ? 'rgba(18,45,69,0.05)' : 'transparent',
                    }}
                  >
                    <TokenIcon symbol={t.symbol} size={28} />
                    <div className="text-left">
                      <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                        {t.symbol}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--subtle)' }}>
                        {t.name}
                      </p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* QR code */}
      <div className="mb-5 flex flex-col items-center">
        <div className="relative mb-4 overflow-hidden rounded-3xl p-4"
          style={{ background: 'white', boxShadow: '0 4px 24px rgba(18,45,69,0.10)' }}>
          <canvas ref={canvasRef} style={{ display: 'block', borderRadius: '12px' }} />
          {/* Token badge overlaid on QR */}
          <div className="absolute bottom-6 right-6 rounded-full border-2 border-white shadow-md">
            <TokenIcon symbol={selectedToken.symbol} size={28} />
          </div>
        </div>

        <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          Your Arc Address
        </p>
        <p className="mono mt-1 break-all text-center text-xs" style={{ color: 'var(--muted)' }}>
          {address}
        </p>
      </div>

      {/* Action buttons */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        <button
          onClick={() => { void handleCopy() }}
          className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold transition-all hover:bg-black/8 active:scale-[0.98]"
          style={{
            background: 'rgba(255,255,255,0.60)',
            border: '1px solid rgba(18,45,69,0.12)',
            color: 'var(--ink)',
          }}
        >
          {copied ? <Check className="size-4" style={{ color: 'var(--success)' }} /> : <Copy className="size-4" />}
          {copied ? 'Copied!' : 'Copy Address'}
        </button>
        <button
          onClick={() => { void handleShare() }}
          className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99]"
          style={{ background: 'var(--accent)' }}
        >
          <Share2 className="size-4" />
          Share
        </button>
      </div>

      {/* Warning */}
      <div className="flex gap-2.5 rounded-2xl p-4"
        style={{ background: 'rgba(18,45,69,0.04)', border: '1px solid rgba(18,45,69,0.08)' }}>
        <AlertTriangle className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--subtle)' }} />
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          Only send <strong>{selectedToken.symbol}</strong> on the <strong>Arc</strong> network to this address. Sending assets from other networks may result in permanent loss.
        </p>
      </div>
    </BottomSheet>
  )
}
