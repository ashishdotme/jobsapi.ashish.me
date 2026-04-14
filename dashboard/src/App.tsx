import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminLayout } from './components/AdminLayout'
import { JobDetailPage } from './pages/JobDetailPage'
import { JobsPage } from './pages/JobsPage'
import { MoviesPage } from './pages/MoviesPage'
import { SettingsPage } from './pages/SettingsPage'
import { ShowsPage } from './pages/ShowsPage'
import { UploadPage } from './pages/UploadPage'
import { UpdatesPage } from './pages/UpdatesPage'

function App() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route path="/" element={<Navigate to="/imports" replace />} />
        <Route path="/imports" element={<UploadPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/jobs/:jobId" element={<JobDetailPage />} />
        <Route path="/movies" element={<MoviesPage />} />
        <Route path="/shows" element={<ShowsPage />} />
        <Route path="/updates" element={<UpdatesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/imports" replace />} />
    </Routes>
  )
}

export default App
