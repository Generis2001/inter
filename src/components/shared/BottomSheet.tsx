import React from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { spectral } from './GlassCard'
import { easeOut, sheetSpring } from '../../utils/motion'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  showSpectral?: boolean
}

export function BottomSheet({ open, onClose, title, children, showSpectral = true }: BottomSheetProps) {
  const reducedMotion = useReducedMotion()
  // Page transition/blur layers create stacking contexts. Mount sheets at the
  // document root so confirmation and PIN controls stay above navigation.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={onClose}
        >
          <motion.div className="absolute inset-0 bg-black/25 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.1 : 0.2, ease: easeOut }} />
          <motion.section
            className="relative w-full max-w-md overflow-hidden rounded-t-3xl"
            style={{
              background: 'var(--sheet-bg)',
              backdropFilter: 'blur(40px) saturate(200%)',
              WebkitBackdropFilter: 'blur(40px) saturate(200%)',
              maxHeight: '90dvh',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
            }}
            initial={reducedMotion ? { opacity: 0 } : { y: '100%' }}
            animate={{ y: 0, opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { y: '100%' }}
            transition={reducedMotion ? { duration: 0.1 } : sheetSpring}
            onClick={(e) => e.stopPropagation()}
          >
            {showSpectral && <div className="h-1" style={{ background: spectral }} />}
            <div className="flex items-center justify-center pt-3 pb-1">
              <div className="h-1 w-9 rounded-full" style={{ background: 'var(--border-strong)' }} />
            </div>
            {title && (
              <div className="flex items-center justify-between px-5 pt-2 pb-0">
                <h2 className="display text-lg font-bold" style={{ color: 'var(--ink)' }}>
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  aria-label={`Close ${title}`}
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
    </AnimatePresence>,
    document.body,
  )
}
