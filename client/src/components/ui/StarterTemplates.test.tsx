import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StarterTemplates from './StarterTemplates'

const storeMock = vi.hoisted(() => ({
    state: {
        pieceCount: 0,
        walls: new Map(),
    },
    applyStarterTemplate: vi.fn(),
}))

vi.mock('../../context/gameStore', () => {
    const useGameStore = (selector: (state: typeof storeMock.state & {
        applyStarterTemplate: typeof storeMock.applyStarterTemplate
    }) => unknown) => {
        return selector({
            ...storeMock.state,
            applyStarterTemplate: storeMock.applyStarterTemplate,
        })
    }

    return { useGameStore }
})

beforeEach(() => {
    storeMock.state.pieceCount = 0
    storeMock.state.walls = new Map()
    storeMock.applyStarterTemplate.mockReset()
})

describe('StarterTemplates', () => {
    it('applies the selected template', async () => {
        render(<StarterTemplates />)

        await userEvent.click(screen.getByRole('button', { name: /classic house/i }))

        expect(storeMock.applyStarterTemplate).toHaveBeenCalledWith('classic-house')
    })

    it('disables template buttons once the room has content', () => {
        storeMock.state.pieceCount = 2

        render(<StarterTemplates />)

        expect(screen.getByRole('button', { name: /classic house/i })).toBeDisabled()
        expect(screen.getByText('Blank room required')).toBeInTheDocument()
    })

    it('does not mark a template as added when applying fails', async () => {
        storeMock.applyStarterTemplate.mockRejectedValueOnce(new Error('Template failed'))

        render(<StarterTemplates />)

        await userEvent.click(screen.getByRole('button', { name: /classic house/i }))

        expect(screen.queryByText('Classic House added')).not.toBeInTheDocument()
    })
})
