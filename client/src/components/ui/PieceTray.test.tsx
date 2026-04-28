import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PieceTray from './PieceTray'

const storeMock = vi.hoisted(() => ({
    state: {
        pieceCount: 0,
        maxPieces: 120,
    },
    spawnPiece: vi.fn(),
    setBuildMode: vi.fn(),
}))

vi.mock('../../context/gameStore', () => ({
    useGameStore: (selector: (state: typeof storeMock.state & {
        spawnPiece: typeof storeMock.spawnPiece
        setBuildMode: typeof storeMock.setBuildMode
    }) => unknown) => selector({
        ...storeMock.state,
        spawnPiece: storeMock.spawnPiece,
        setBuildMode: storeMock.setBuildMode,
    }),
}))

beforeEach(() => {
    storeMock.state.pieceCount = 0
    storeMock.state.maxPieces = 120
    storeMock.spawnPiece.mockReset()
    storeMock.spawnPiece.mockResolvedValue(null)
    storeMock.setBuildMode.mockReset()
})

describe('PieceTray', () => {
    it('filters visible pieces by category tabs', async () => {
        const user = userEvent.setup()
        render(<PieceTray />)

        expect(screen.getByRole('tablist', { name: /piece categories/i })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: /all/i })).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByRole('button', { name: /gumdrop/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /star/i })).toBeInTheDocument()

        await user.click(screen.getByRole('tab', { name: /structure/i }))

        expect(screen.getByRole('tab', { name: /structure/i })).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByRole('button', { name: /door/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /chimney/i })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /gumdrop/i })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /star/i })).not.toBeInTheDocument()
    })

    it('spawns pieces from the selected category', async () => {
        const user = userEvent.setup()
        render(<PieceTray />)

        await user.click(screen.getByRole('tab', { name: /candy/i }))
        await user.click(screen.getByRole('button', { name: /gumdrop/i }))

        expect(storeMock.setBuildMode).toHaveBeenCalledWith('select')
        expect(storeMock.spawnPiece).toHaveBeenCalledWith('GUMDROP')
    })

    it('keeps the fence post shortcut as a build tool action', async () => {
        const user = userEvent.setup()
        render(<PieceTray />)

        await user.click(screen.getByRole('tab', { name: /structure/i }))
        await user.click(screen.getByRole('button', { name: /fence/i }))

        expect(storeMock.setBuildMode).toHaveBeenCalledWith('fence')
        expect(storeMock.spawnPiece).not.toHaveBeenCalled()
    })
})
