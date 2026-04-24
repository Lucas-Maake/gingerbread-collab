import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppErrorBoundary from './AppErrorBoundary'

function ThrowError({ error }: { error: Error }) {
    throw error
    return null
}

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('AppErrorBoundary', () => {
    it('shows a recovery screen when a child crashes', () => {
        render(
            <AppErrorBoundary onReload={vi.fn()}>
                <ThrowError error={new Error('render failed')} />
            </AppErrorBoundary>
        )

        expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
        expect(screen.getByRole('button', { name: /reload app/i })).toBeInTheDocument()
    })

    it('uses chunk-load copy and calls reload when a lazy route chunk fails', async () => {
        const reload = vi.fn()

        render(
            <AppErrorBoundary onReload={reload}>
                <ThrowError error={new Error('Failed to fetch dynamically imported module')} />
            </AppErrorBoundary>
        )

        expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load this part of the app")

        await userEvent.click(screen.getByRole('button', { name: /reload app/i }))

        expect(reload).toHaveBeenCalledTimes(1)
    })
})
