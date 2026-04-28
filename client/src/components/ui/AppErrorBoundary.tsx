import { Component, ErrorInfo, ReactNode } from 'react'
import './AppErrorBoundary.css'

interface AppErrorBoundaryProps {
    children: ReactNode
    onReload?: () => void
}

interface AppErrorBoundaryState {
    error: Error | null
}

function isChunkLoadError(error: Error): boolean {
    return /chunkloaderror|loading chunk|dynamically imported module|failed to fetch/i.test(error.message)
}

export default class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
    state: AppErrorBoundaryState = {
        error: null,
    }

    static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
        return { error }
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('Unhandled app error', error, info)
    }

    handleReload = () => {
        if (this.props.onReload) {
            this.props.onReload()
            return
        }

        window.location.reload()
    }

    render() {
        if (!this.state.error) {
            return this.props.children
        }

        const chunkLoadError = isChunkLoadError(this.state.error)
        const title = chunkLoadError
            ? "Couldn't load this part of the app"
            : 'Something went wrong'
        const message = chunkLoadError
            ? 'The latest app files may not be loaded yet. Reload to fetch a fresh copy.'
            : 'Reload the app to get back to your gingerbread build.'

        return (
            <div className="app-error-boundary" role="alert">
                <div className="app-error-panel">
                    <span className="app-error-icon" aria-hidden="true">!</span>
                    <h1>{title}</h1>
                    <p>{message}</p>
                    <button type="button" onClick={this.handleReload}>
                        Reload App
                    </button>
                </div>
            </div>
        )
    }
}
