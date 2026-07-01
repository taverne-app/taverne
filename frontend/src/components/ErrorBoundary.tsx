import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-stone-950 flex items-center justify-center px-4">
          <div className="max-w-lg w-full bg-stone-900 border border-red-800 rounded-xl p-6 space-y-3">
            <p className="text-red-400 font-semibold text-sm">Erreur de rendu</p>
            <p className="text-stone-300 text-sm font-mono break-all">{this.state.error.message}</p>
            <pre className="text-stone-500 text-xs overflow-auto max-h-40">{this.state.error.stack}</pre>
            <button
              onClick={() => this.setState({ error: null })}
              className="text-amber-400 hover:text-amber-300 text-sm transition-colors"
            >
              Réessayer
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
