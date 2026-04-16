import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppProviders } from '@/app/providers'
import { TooltipProvider } from '@/components/ui/tooltip'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider delayDuration={100}>
      <AppProviders>
        <BrowserRouter basename="/dashboard">
          <App />
        </BrowserRouter>
      </AppProviders>
    </TooltipProvider>
  </StrictMode>,
)
