import { Routes, Route } from 'react-router-dom'
import LandingPage from './components/ui/LandingPage'
import RoomPage from './components/ui/RoomPage'

function App() {
    return (
        <div className="app">
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/room/:roomId" element={<RoomPage />} />
            </Routes>
        </div>
    )
}

export default App
