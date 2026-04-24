import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RoomPage from './RoomPage'

const gameStoreMock = vi.hoisted(() => ({
    state: {
        connectionState: 'connected',
        pieceCount: 0,
        maxPieces: 120,
        undoCount: 0,
    },
    initSocketListeners: vi.fn(),
    joinRoom: vi.fn(),
    leaveRoom: vi.fn(),
    undo: vi.fn(),
}))

vi.mock('../../context/gameStore', () => {
    const useGameStore = ((selector: (state: typeof gameStoreMock.state) => unknown) => {
        return selector(gameStoreMock.state)
    }) as {
        (selector: (state: typeof gameStoreMock.state) => unknown): unknown
        getState: () => {
            joinRoom: typeof gameStoreMock.joinRoom
            leaveRoom: typeof gameStoreMock.leaveRoom
            undo: typeof gameStoreMock.undo
        }
    }

    useGameStore.getState = () => ({
        joinRoom: gameStoreMock.joinRoom,
        leaveRoom: gameStoreMock.leaveRoom,
        undo: gameStoreMock.undo,
    })

    return {
        initSocketListeners: gameStoreMock.initSocketListeners,
        useGameStore,
    }
})

vi.mock('../3d/Scene', () => ({
    default: () => null,
}))

function renderRoomPage() {
    render(
        <MemoryRouter
            initialEntries={['/room/ABC123']}
            future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        >
            <Routes>
                <Route path="/" element={<div>Home</div>} />
                <Route path="/room/:roomId" element={<RoomPage />} />
            </Routes>
        </MemoryRouter>
    )
}

beforeEach(() => {
    localStorage.clear()
    gameStoreMock.state.connectionState = 'connected'
    gameStoreMock.state.pieceCount = 0
    gameStoreMock.state.maxPieces = 120
    gameStoreMock.state.undoCount = 0
    gameStoreMock.initSocketListeners.mockReset()
    gameStoreMock.joinRoom.mockReset()
    gameStoreMock.leaveRoom.mockReset()
    gameStoreMock.undo.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('RoomPage', () => {
    it('explains backend connection failures while joining a room', async () => {
        gameStoreMock.joinRoom.mockRejectedValueOnce(new TypeError('Failed to fetch'))

        renderRoomPage()

        expect(await screen.findByRole('alertdialog', { name: /unable to join room/i })).toBeInTheDocument()
        expect(screen.getByText('Server is offline. Start the backend and try again.')).toBeInTheDocument()
        expect(gameStoreMock.initSocketListeners).toHaveBeenCalledTimes(1)
        expect(gameStoreMock.joinRoom).toHaveBeenCalledWith('ABC123', 'Guest')
    })
})
