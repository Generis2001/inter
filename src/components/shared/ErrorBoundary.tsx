import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { PageBackground } from './PageBackground'

interface Props {
  children: ReactNode
  fallbackTitle?: string
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Inter Wallet ErrorBoundary caught error]:', error, errorInfo)
    this.setState({ errorInfo })
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    if (this.props.onReset) {
      this.props.onReset()
    } else {
      window.location.reload()
    }
  }

  private handleReturnHome = () => {
    try {
      sessionStorage.clear()
    } catch {}
    this.setState({ hasError: false, error: null, errorInfo: null })
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'An unexpected rendering error occurred.'

      return (
        <PageBackground>
          <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-8 text-center">
            <div
              className="mx-auto mb-5 flex size-16 items-center justify-center rounded-3xl"
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
              }}
            >
              <AlertTriangle className="size-8" style={{ color: 'var(--danger)' }} />
            </div>

            <h1
              className="mb-2 text-2xl font-bold tracking-tight"
              style={{ color: 'var(--ink)' }}
            >
              {this.props.fallbackTitle ?? 'Something went wrong'}
            </h1>

            <p
              className="mb-5 text-sm"
              style={{ color: 'var(--muted)' }}
            >
              Inter encountered an unexpected error while loading this view. Your funds and recovery phrase remain safe.
            </p>

            <div
              className="mb-6 max-h-36 overflow-y-auto rounded-2xl p-3 text-left text-xs"
              style={{
                background: 'rgba(255, 255, 255, 0.70)',
                border: '1px solid rgba(239, 68, 68, 0.18)',
                color: 'var(--ink)',
                fontFamily: 'monospace',
              }}
            >
              <span className="font-semibold text-red-600">Error: </span>
              {errorMessage}
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{ background: 'var(--accent-gradient)' }}
              >
                <RefreshCw className="size-4" />
                Reload View
              </button>

              <button
                onClick={this.handleReturnHome}
                className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold transition-all hover:bg-black/5"
                style={{
                  background: 'rgba(255, 255, 255, 0.65)',
                  border: '1px solid rgba(6, 182, 212, 0.20)',
                  color: 'var(--ink)',
                }}
              >
                <Home className="size-4" />
                Return to Start
              </button>
            </div>
          </div>
        </PageBackground>
      )
    }

    return this.props.children
  }
}
