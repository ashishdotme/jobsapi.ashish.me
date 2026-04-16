import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { AppProviders } from '@/app/providers'
import { useAuthStore } from '@/state/auth-store'
import { SettingsPage } from './SettingsPage'

describe('SettingsPage', () => {
  afterEach(() => {
    useAuthStore.getState().clearApiKey()
    window.localStorage.clear()
  })

  it('reads the api key from the auth store and clears it on demand', async () => {
    const user = userEvent.setup()
    useAuthStore.getState().setApiKey('valid-key')

    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/settings']}>
          <Routes>
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/login" element={<div>Login page</div>} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    )

    expect(screen.getByPlaceholderText(/enter jobsapi api key/i)).toHaveValue('valid-key')

    await user.click(screen.getByRole('button', { name: /clear/i }))

    expect(useAuthStore.getState().apiKey).toBe('')
    expect(await screen.findByText(/login page/i)).toBeInTheDocument()
  })
})
