import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import LandingPage from './LandingPage'

function renderLandingPage() {
    render(
        <MemoryRouter
            initialEntries={['/']}
            future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        >
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/room/:roomId" element={<div>Room page</div>} />
            </Routes>
        </MemoryRouter>
    )
}

afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
})

describe('LandingPage', () => {
    it('announces backend connection failures while creating a room', async () => {
        const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
        vi.stubGlobal('fetch', fetchMock)

        renderLandingPage()

        await userEvent.click(screen.getByRole('button', { name: /create new room/i }))

        const alert = await screen.findByRole('alert')
        expect(alert).toHaveTextContent('Server is offline. Start the backend and try again.')
        expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/api/room', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
        })
        expect(screen.getByRole('button', { name: /create new room/i })).toBeEnabled()
    })
})
