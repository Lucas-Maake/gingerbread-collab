import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RoomPage from './RoomPage'

const gameStoreMock = vi.hoisted(() => ({
    state: {
        connectionState: 'connected',
        pieceCount: 0,
        maxPieces: 120,
        undoCount: 0,
        users: new Map(),
        pieces: new Map(),
        walls: new Map(),
        undo: vi.fn(),
        historyEntries: [] as Array<{
            id: string
            action: string
            userId: string | null
            userName: string
            userColor: string | null
            description: string
            createdAt: number
        }>,
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

vi.mock('./PresenceBar', () => ({
    default: () => <div data-testid="presence-bar">Presence</div>,
}))

vi.mock('./PieceTray', () => ({
    default: () => <div data-testid="piece-tray">Piece Tray</div>,
}))

vi.mock('./MuteButton', () => ({
    default: () => <button type="button">Music</button>,
}))

vi.mock('./SfxMuteButton', () => ({
    default: () => <button type="button">SFX</button>,
}))

vi.mock('./ScreenshotButton', () => ({
    default: () => <button type="button" aria-label="Take screenshot">Screenshot</button>,
}))

vi.mock('./ResetCameraButton', () => ({
    default: () => <button type="button">Reset View</button>,
}))

vi.mock('./ResetRoomButton', () => ({
    default: () => <button type="button">Reset Room</button>,
}))

vi.mock('./DayNightToggle', () => ({
    default: () => <button type="button">Day/Night</button>,
}))

vi.mock('./BuildToolbar', () => ({
    default: () => <div data-testid="build-toolbar">Build Toolbar</div>,
}))

vi.mock('./PieceActionToolbar', () => ({
    default: () => <div data-testid="piece-action-toolbar">Piece Action Toolbar</div>,
}))

vi.mock('./ChatPanel', () => ({
    default: () => <div data-testid="chat-panel">Chat</div>,
}))

vi.mock('./CameraPresets', () => ({
    default: () => <div data-testid="camera-presets">Camera Presets</div>,
}))

vi.mock('./StarterTemplates', () => ({
    default: () => <div data-testid="starter-templates">Starter Templates</div>,
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
    gameStoreMock.state.users = new Map()
    gameStoreMock.state.pieces = new Map()
    gameStoreMock.state.walls = new Map()
    gameStoreMock.state.historyEntries = []
    gameStoreMock.initSocketListeners.mockReset()
    gameStoreMock.joinRoom.mockReset()
    gameStoreMock.leaveRoom.mockReset()
    gameStoreMock.undo.mockReset()
    gameStoreMock.state.undo = gameStoreMock.undo
    Object.defineProperty(document, 'execCommand', {
        value: vi.fn(() => true),
        configurable: true,
    })
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

    it('enters photo mode with editing controls hidden and screenshot still available', async () => {
        const user = userEvent.setup()
        gameStoreMock.joinRoom.mockResolvedValueOnce(undefined)

        renderRoomPage()

        expect(await screen.findByRole('heading', { name: /room: ABC123/i })).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: /photo mode/i }))

        expect(screen.queryByRole('heading', { name: /room: ABC123/i })).not.toBeInTheDocument()
        expect(screen.queryByTestId('piece-tray')).not.toBeInTheDocument()
        expect(screen.queryByTestId('build-toolbar')).not.toBeInTheDocument()
        expect(screen.queryByTestId('chat-panel')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /exit photo mode/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /take screenshot/i })).toBeInTheDocument()
    })

    it('restores the builder controls after exiting photo mode', async () => {
        const user = userEvent.setup()
        gameStoreMock.joinRoom.mockResolvedValueOnce(undefined)

        renderRoomPage()

        await screen.findByRole('heading', { name: /room: ABC123/i })
        await user.click(screen.getByRole('button', { name: /photo mode/i }))
        await user.click(screen.getByRole('button', { name: /exit photo mode/i }))

        expect(screen.getByRole('heading', { name: /room: ABC123/i })).toBeInTheDocument()
        expect(screen.getByTestId('piece-tray')).toBeInTheDocument()
        expect(screen.getByTestId('build-toolbar')).toBeInTheDocument()
        expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
    })

    it('shows recent build history and exposes undo from the panel', async () => {
        const user = userEvent.setup()
        gameStoreMock.joinRoom.mockResolvedValueOnce(undefined)
        gameStoreMock.state.undoCount = 1
        gameStoreMock.state.historyEntries = [{
            id: 'hist-1',
            action: 'piece_spawned',
            userId: 'user-1',
            userName: 'Alex',
            userColor: '#38bdf8',
            description: 'placed Gumdrop',
            createdAt: Date.now(),
        }]

        renderRoomPage()

        await screen.findByRole('heading', { name: /room: ABC123/i })
        await user.click(screen.getByRole('button', { name: /history/i }))

        expect(screen.getByRole('region', { name: /build history/i })).toBeInTheDocument()
        expect(screen.getByText('Alex')).toBeInTheDocument()
        expect(screen.getByText('placed Gumdrop')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /undo last action/i }))
        expect(gameStoreMock.undo).toHaveBeenCalledTimes(1)
    })

    it('shows a clear invite affordance with the room code', async () => {
        gameStoreMock.joinRoom.mockResolvedValueOnce(undefined)

        renderRoomPage()

        expect(await screen.findByRole('region', { name: /invite room/i })).toBeInTheDocument()
        expect(screen.getByText('ABC123')).toBeInTheDocument()
        expect(screen.getByText(/share this room with friends/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /copy invite link/i })).toBeInTheDocument()
    })

    it('shows intentional feedback after copying the invite link', async () => {
        const user = userEvent.setup()
        gameStoreMock.joinRoom.mockResolvedValueOnce(undefined)

        renderRoomPage()

        await screen.findByRole('region', { name: /invite room/i })
        await user.click(screen.getByRole('button', { name: /copy invite link/i }))

        expect(document.execCommand).toHaveBeenCalledWith('copy')
        expect(screen.getByRole('button', { name: /invite copied/i })).toBeInTheDocument()
    })

    it('shows a getting started checklist for new rooms', async () => {
        gameStoreMock.joinRoom.mockResolvedValueOnce(undefined)

        renderRoomPage()

        expect(await screen.findByRole('region', { name: /getting started/i })).toBeInTheDocument()
        expect(screen.getByText('0 of 5 complete')).toBeInTheDocument()
        expect(screen.getByText('Start with a template or draw a wall')).toBeInTheDocument()
        expect(screen.getByText('Add roof pieces')).toBeInTheDocument()
        expect(screen.getByText('Place a decoration')).toBeInTheDocument()
        expect(screen.getByText('Invite a friend')).toBeInTheDocument()
        expect(screen.getByText('Try photo mode')).toBeInTheDocument()
    })

    it('tracks onboarding progress from room state and photo mode use', async () => {
        const user = userEvent.setup()
        gameStoreMock.joinRoom.mockResolvedValueOnce(undefined)
        gameStoreMock.state.users = new Map([
            ['user-1', { userId: 'user-1', name: 'Alex', color: '#38bdf8', cursor: { x: 0, y: 0, z: 0, t: 0 }, isActive: true }],
            ['user-2', { userId: 'user-2', name: 'Sam', color: '#ef4444', cursor: { x: 0, y: 0, z: 0, t: 0 }, isActive: true }],
        ])
        gameStoreMock.state.walls = new Map([
            ['wall-1', { wallId: 'wall-1', start: [0, 0], end: [1, 0], height: 1.5, thickness: 0.1, createdBy: 'user-1', version: 1 }],
        ])
        gameStoreMock.state.pieces = new Map([
            ['roof-1', { pieceId: 'roof-1', type: 'ROOF_LEFT', pos: [0, 0, 0], yaw: 0, heldBy: null, spawnedBy: 'user-1', attachedTo: null, snapNormal: null, version: 1 }],
            ['gumdrop-1', { pieceId: 'gumdrop-1', type: 'GUMDROP', pos: [0, 0, 0], yaw: 0, heldBy: null, spawnedBy: 'user-1', attachedTo: null, snapNormal: null, version: 1 }],
        ])

        renderRoomPage()

        expect(await screen.findByText('4 of 5 complete')).toBeInTheDocument()
        expect(screen.getByLabelText('Completed: Start with a template or draw a wall')).toBeInTheDocument()
        expect(screen.getByLabelText('Completed: Add roof pieces')).toBeInTheDocument()
        expect(screen.getByLabelText('Completed: Place a decoration')).toBeInTheDocument()
        expect(screen.getByLabelText('Completed: Invite a friend')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /photo mode/i }))
        await user.click(screen.getByRole('button', { name: /exit photo mode/i }))

        expect(screen.getByText('5 of 5 complete')).toBeInTheDocument()
        expect(screen.getByText('Ready for a snapshot')).toBeInTheDocument()
    })
})
