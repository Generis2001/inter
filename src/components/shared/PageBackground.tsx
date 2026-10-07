import React from 'react'

export function PageBackground({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative min-h-dvh overflow-hidden"
      style={{ background: 'var(--bg-gradient)' }}
    >
      {/* Soft cyan ambient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          style={{
            position: 'absolute',
            top: '6%',
            left: '-5%',
            width: 380,
            height: 380,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(6,182,212,0.14) 0%, transparent 70%)',
            filter: 'blur(70px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '8%',
            right: '-4%',
            width: 320,
            height: 320,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(14,165,233,0.12) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '45%',
            left: '40%',
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(6,182,212,0.07) 0%, transparent 70%)',
            filter: 'blur(50px)',
          }}
        />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  )
}
