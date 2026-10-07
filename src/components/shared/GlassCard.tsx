import React from 'react'
import { clsx } from 'clsx'

const glass = {
  card: {
    background: 'rgba(255, 255, 255, 0.70)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(6, 182, 212, 0.15)',
    boxShadow: '0 8px 32px rgba(6, 182, 212, 0.08), inset 0 1px 0 rgba(255,255,255,0.60)',
  } as React.CSSProperties,
  inner: {
    background: 'rgba(255, 255, 255, 0.52)',
    border: '1px solid rgba(6, 182, 212, 0.12)',
  } as React.CSSProperties,
  pill: {
    background: 'rgba(255, 255, 255, 0.62)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(6, 182, 212, 0.14)',
  } as React.CSSProperties,
}

export { glass }

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  variant?: 'card' | 'inner' | 'pill'
  style?: React.CSSProperties
  onClick?: () => void
}

export function GlassCard({ children, className, variant = 'card', style, onClick }: GlassCardProps) {
  return (
    <div
      className={clsx('rounded-3xl', className)}
      style={{ ...glass[variant], ...style }}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

/** Accent gradient - cyan-500 → sky-500 */
export const spectral = 'linear-gradient(90deg, #06b6d4, #0ea5e9, #818cf8, #a78bfa)'
