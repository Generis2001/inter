import React from 'react'
import { clsx } from 'clsx'

const glass = {
  card: {
    background: 'var(--glass-bg)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid var(--glass-border)',
    boxShadow: 'var(--glass-shadow)',
  } as React.CSSProperties,
  inner: {
    background: 'var(--glass-bg-inner)',
    border: '1px solid var(--glass-inner-border)',
  } as React.CSSProperties,
  pill: {
    background: 'var(--glass-bg-pill)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid var(--glass-pill-border)',
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

/** Accent gradient — cyan-500 → sky-500 */
export const spectral = 'linear-gradient(90deg, #06b6d4, #0ea5e9, #818cf8, #a78bfa)'
