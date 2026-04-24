import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import LandingPage from './components/ui/LandingPage'

const RoomPage = lazy(() => import('./components/ui/RoomPage'))

function App() {
    return (
        <div className="app">
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
        </div>
    )
}

export default App
