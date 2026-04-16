import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminLayout } from './components/AdminLayout'
import { AuthGate } from './components/AuthGate'
import { JobDetailPage } from './pages/JobDetailPage'
import { JobsPage } from './pages/JobsPage'
import { LoginPage } from './pages/LoginPage'
import { MoviesPage } from './pages/MoviesPage'
import { TodosPage } from './pages/TodosPage'
import { SettingsPage } from './pages/SettingsPage'
import { ShowsPage } from './pages/ShowsPage'
import { UploadPage } from './pages/UploadPage'
import { UpdatesPage } from './pages/UpdatesPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AuthGate />}>
        <Route element={<AdminLayout />}>
          <Route path="/" element={<Navigate to="/imports" replace />} />
          <Route path="/imports" element={<UploadPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/jobs/:jobId" element={<JobDetailPage />} />
          <Route path="/todos" element={<TodosPage />} />
          <Route path="/movies" element={<MoviesPage />} />
          <Route path="/shows" element={<ShowsPage />} />
          <Route path="/updates" element={<UpdatesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
