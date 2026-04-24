import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PieceState } from '../../types'
import PieceActionToolbar from './PieceActionToolbar'

const storeMock = vi.hoisted(() => ({
    state: {
        userId: 'user-1',
        heldPieceId: null as string | null,
        pieces: new Map<string, PieceState>(),
        pieceCount: 1,
        maxPieces: 50,
    },
    updatePieceTransform: vi.fn(),
    releasePiece: vi.fn(),
    spawnPiece: vi.fn(),
    deletePiece: vi.fn(),
}))

vi.mock('../../context/gameStore', () => ({
    useGameStore: (selector: (state: typeof storeMock.state & {
        updatePieceTransform: typeof storeMock.updatePieceTransform
        releasePiece: typeof storeMock.releasePiece
        spawnPiece: typeof storeMock.spawnPiece
        deletePiece: typeof storeMock.deletePiece
    }) => unknown) => selector({
        ...storeMock.state,
        updatePieceTransform: storeMock.updatePieceTransform,
        releasePiece: storeMock.releasePiece,
        spawnPiece: storeMock.spawnPiece,
        deletePiece: storeMock.deletePiece,
    }),
}))

function makePiece(overrides: Partial<PieceState> = {}): PieceState {
    return {
        pieceId: 'piece-1',
        type: 'GUMDROP',
        pos: [1, 0.1, 2],
        yaw: 0.25,
        heldBy: 'user-1',
        spawnedBy: 'user-1',
        attachedTo: null,
        snapNormal: null,
        version: 1,
        ...overrides,
    }
}

function holdPiece(piece = makePiece()) {
    storeMock.state.userId = 'user-1'
    storeMock.state.heldPieceId = piece.pieceId
    storeMock.state.pieces = new Map([[piece.pieceId, piece]])
    storeMock.state.pieceCount = 1
    storeMock.state.maxPieces = 50
    return piece
}

beforeEach(() => {
    storeMock.state.userId = 'user-1'
    storeMock.state.heldPieceId = null
    storeMock.state.pieces = new Map()
    storeMock.state.pieceCount = 1
    storeMock.state.maxPieces = 50
    storeMock.updatePieceTransform.mockReset()
    storeMock.releasePiece.mockReset()
    storeMock.releasePiece.mockResolvedValue(undefined)
    storeMock.spawnPiece.mockReset()
    storeMock.spawnPiece.mockResolvedValue(null)
    storeMock.deletePiece.mockReset()
    storeMock.deletePiece.mockResolvedValue(undefined)
})

describe('PieceActionToolbar', () => {
    it('stays hidden when the local user is not holding a piece', () => {
        render(<PieceActionToolbar />)

        expect(screen.queryByRole('status', { name: /piece shortcuts/i })).not.toBeInTheDocument()
    })

    it('can appear after a piece is grabbed without changing hook order', () => {
        const { rerender } = render(<PieceActionToolbar />)

        holdPiece()
        rerender(<PieceActionToolbar />)

        expect(screen.getByRole('status', { name: /piece shortcuts/i })).toHaveTextContent('Gumdrop')
    })

    it('shows keyboard shortcuts instead of click targets while holding a piece', () => {
        holdPiece()

        render(<PieceActionToolbar />)

        expect(screen.getByRole('status', { name: /piece shortcuts/i })).toHaveTextContent('Gumdrop')
        expect(screen.getByText('Q')).toBeInTheDocument()
        expect(screen.getByText('E')).toBeInTheDocument()
        expect(screen.getByText('D')).toBeInTheDocument()
        expect(screen.getByText('Enter')).toBeInTheDocument()
        expect(screen.getByText('Del')).toBeInTheDocument()
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('duplicates the held piece near the original placement from the keyboard', async () => {
        const piece = holdPiece()
        const duplicate = makePiece({ pieceId: 'piece-2', pos: [0, 0, 0] })
        storeMock.spawnPiece.mockResolvedValue(duplicate)

        render(<PieceActionToolbar />)

        await userEvent.keyboard('d')

        await waitFor(() => expect(storeMock.spawnPiece).toHaveBeenCalledWith(piece.type))
        expect(storeMock.releasePiece).toHaveBeenNthCalledWith(
            1,
            piece.pos,
            piece.yaw,
            piece.attachedTo,
            piece.snapNormal
        )
        expect(storeMock.releasePiece).toHaveBeenNthCalledWith(
            2,
            [1.5, 0.1, 2.5],
            piece.yaw,
            piece.attachedTo,
            piece.snapNormal
        )
    })

    it('places the held piece from the keyboard', async () => {
        const piece = holdPiece()

        render(<PieceActionToolbar />)

        await userEvent.keyboard('{Enter}')

        expect(storeMock.releasePiece).toHaveBeenCalledWith(
            piece.pos,
            piece.yaw,
            piece.attachedTo,
            piece.snapNormal
        )
    })

    it('only deletes pieces created by the local user', async () => {
        holdPiece(makePiece({ spawnedBy: 'other-user' }))

        render(<PieceActionToolbar />)

        expect(screen.getByText('Delete').closest('.piece-action-shortcut')).toHaveAttribute('aria-disabled', 'true')
        await userEvent.keyboard('{Delete}')
        expect(storeMock.deletePiece).not.toHaveBeenCalled()
    })

    it('ignores action shortcuts while typing in an input', async () => {
        holdPiece()

        render(
            <>
                <label>
                    Chat
                    <input />
                </label>
                <PieceActionToolbar />
            </>
        )

        await userEvent.click(screen.getByLabelText('Chat'))
        await userEvent.keyboard('d{Enter}{Delete}')

        expect(storeMock.spawnPiece).not.toHaveBeenCalled()
        expect(storeMock.releasePiece).not.toHaveBeenCalled()
        expect(storeMock.deletePiece).not.toHaveBeenCalled()
    })
})
