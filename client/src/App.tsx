import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import LandingPage from './components/ui/LandingPage'
import AppErrorBoundary from './components/ui/AppErrorBoundary'

const RoomPage = lazy(() => import('./components/ui/RoomPage'))

function App() {
    return (
        <div className="app">
            <AppErrorBoundary>
                <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route
                        path="/room/:roomId"
                        element={(
                            <Suspense fallback={null}>
                                <RoomPage />
                            </Suspense>
                        )}
                    />
                </Routes>
            </AppErrorBoundary>
        </div>
    )
}

export default App
