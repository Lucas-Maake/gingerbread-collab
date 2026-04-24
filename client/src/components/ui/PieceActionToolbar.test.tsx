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

        expect(screen.queryByRole('toolbar', { name: /piece actions/i })).not.toBeInTheDocument()
    })

    it('rotates the held piece using the current position and yaw', async () => {
        const piece = holdPiece()

        render(<PieceActionToolbar />)

        await userEvent.click(screen.getByRole('button', { name: /rotate left/i }))

        expect(storeMock.updatePieceTransform).toHaveBeenCalledWith(
            piece.pieceId,
            piece.pos,
            expect.closeTo(piece.yaw + Math.PI / 8)
        )
    })

    it('duplicates the held piece near the original placement', async () => {
        const piece = holdPiece()
        const duplicate = makePiece({ pieceId: 'piece-2', pos: [0, 0, 0] })
        storeMock.spawnPiece.mockResolvedValue(duplicate)

        render(<PieceActionToolbar />)

        await userEvent.click(screen.getByRole('button', { name: /duplicate/i }))

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

    it('only enables delete for pieces created by the local user', async () => {
        holdPiece(makePiece({ spawnedBy: 'other-user' }))

        render(<PieceActionToolbar />)

        const deleteButton = screen.getByRole('button', { name: /delete/i })
        expect(deleteButton).toBeDisabled()

        await userEvent.click(deleteButton)
        expect(storeMock.deletePiece).not.toHaveBeenCalled()
    })
})
