import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { spectral } from './GlassCard'

const springs = {
  sheet: { type: 'spring' as const, stiffness: 380, damping: 38 },
}

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  showSpectral?: boolean
}

export function BottomSheet({ open, onClose, title, children, showSpectral = true }: BottomSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" />
          <motion.section
            className="relative w-full max-w-md overflow-hidden rounded-t-3xl"
            style={{
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(40px) saturate(200%)',
              WebkitBackdropFilter: 'blur(40px) saturate(200%)',
              maxHeight: '90dvh',
              overflowY: 'auto',
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={springs.sheet}
            onClick={(e) => e.stopPropagation()}
          >
            {showSpectral && <div className="h-1" style={{ background: spectral }} />}
            <div className="flex items-center justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-black/10" />
            </div>
            {title && (
              <div className="flex items-center justify-between px-5 pt-2 pb-0">
                <h2 className="display text-lg font-bold" style={{ color: 'var(--ink)' }}>
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-black/5"
                  style={{ color: 'var(--subtle)' }}
                >
                  <X className="size-4" />
                </button>
              </div>
            )}
            <div className="px-5 pb-6 pt-3">{children}</div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
