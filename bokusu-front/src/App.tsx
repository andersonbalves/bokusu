import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { PlayerLayout } from './layouts/PlayerLayout'
import { QueuePage } from './pages/QueuePage'
import { SearchPage } from './pages/SearchPage'
import { SettingsPage } from './pages/SettingsPage'
import { LibraryPage } from './pages/LibraryPage'
import { RenamerPage } from './pages/RenamerPage'
import { PlayerPage } from './pages/PlayerPage'
import { useAuthStatus } from './hooks/useAuthStatus'

export default function App() {
  useAuthStatus()

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/queue" replace />} />
          <Route path="/queue" element={<QueuePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/library/renamer" element={<RenamerPage />} />
        </Route>
        <Route element={<PlayerLayout />}>
          <Route path="/player" element={<PlayerPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
