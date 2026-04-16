import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppProviders } from '@/app/providers'
import { useAuthStore } from '@/state/auth-store'
import { LoginPage } from './LoginPage'

describe('LoginPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    useAuthStore.getState().clearApiKey()
    window.localStorage.clear()
  })

  it('stores the api key and redirects after a successful login', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    })

    vi.stubGlobal('fetch', fetchMock)

    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/imports" element={<div>Imports page</div>} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    )

    await user.type(screen.getByLabelText(/api key/i), 'valid-key')
    await user.click(screen.getByRole('button', { name: /unlock dashboard/i }))

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.ashish.me/login',
      expect.objectContaining({
        headers: expect.objectContaining({
          apiKey: 'valid-key',
        }),
        method: 'POST',
      }),
    )
    expect(useAuthStore.getState().apiKey).toBe('valid-key')
    expect(await screen.findByText(/imports page/i)).toBeInTheDocument()
  })

  it('shows an invalid key error when the upstream login returns 401', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ success: false }),
    })

    vi.stubGlobal('fetch', fetchMock)

    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    )

    await user.type(screen.getByLabelText(/api key/i), 'wrong-key')
    await user.click(screen.getByRole('button', { name: /unlock dashboard/i }))

    expect(await screen.findByText(/invalid api key/i)).toBeInTheDocument()
    expect(useAuthStore.getState().apiKey).toBe('')
  })
})
