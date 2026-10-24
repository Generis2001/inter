/** Theme persistence utilities for Inter Wallet. */
export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'inter_theme'

export function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') return stored
  } catch {}
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
  try { localStorage.setItem(STORAGE_KEY, theme) } catch {}
}
