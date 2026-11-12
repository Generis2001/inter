import React from 'react'

export function PageBackground({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative min-h-dvh overflow-hidden"
      style={{ background: 'var(--bg-gradient)' }}
    >
      {/* Static gradients keep the atmosphere without large blurred layers
          being repainted while screens move. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true"
        style={{ background: 'radial-gradient(ellipse at 0% 10%, rgba(6,182,212,0.06), transparent 45%), radial-gradient(ellipse at 100% 85%, rgba(14,165,233,0.05), transparent 45%)' }} />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
