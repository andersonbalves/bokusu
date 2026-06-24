import { Outlet } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'

export function AppLayout() {
  const theme = useAppStore((state) => state.theme)

  return (
    <div data-theme={theme} className="min-h-screen bg-base-100 text-base-content">
      <nav className="navbar bg-base-200">
        <div className="flex-1">
          <a className="btn btn-ghost text-xl font-display">Pikaraoke</a>
        </div>
      </nav>
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  )
}
