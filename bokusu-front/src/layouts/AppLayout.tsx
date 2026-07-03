import { Outlet, NavLink } from 'react-router-dom'
import { ListMusic, Search, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store/useAppStore'
import { AdminModal } from '../components/AdminModal'
import { ToastHost } from '../components/ToastHost'
import { MiniPlayer } from '../components/MiniPlayer'
import { RemoteDrawer } from '../components/RemoteDrawer'
import { useState } from 'react'

const navItems = [
  { to: '/queue', labelKey: 'nav.queue', Icon: ListMusic },
  { to: '/search', labelKey: 'nav.search', Icon: Search },
  { to: '/settings', labelKey: 'nav.settings', Icon: Settings },
]

export function AppLayout() {
  const { t } = useTranslation()
  const theme = useAppStore((state) => state.theme)
  const isConnected = useAppStore((state) => state.isConnected)
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div data-theme={theme} className="min-h-screen bg-base-100 text-base-content lg:flex relative">
      {!isConnected && (
        <div className="toast toast-top toast-center z-50">
          <div className="alert alert-error">
            <span>{t('toasts.noConnection')}</span>
          </div>
        </div>
      )}

      {/* Sidebar — desktop only */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:min-h-screen lg:bg-base-200 lg:border-r lg:border-base-300">
        <div className="p-6">
          <span className="font-display text-2xl text-primary">Bokusu</span>
        </div>
        <nav className="flex-1 px-3">
          <ul className="menu menu-lg gap-1 w-full p-0">
            {navItems.map(({ to, labelKey, Icon }) => (
              <li key={to}>
                <NavLink to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
                  <Icon size={20} />
                  {t(labelKey)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4 border-t border-base-300">
          <MiniPlayer onExpand={() => setDrawerOpen(true)} />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-36 lg:pb-0">
        <Outlet />
      </main>

      {/* MiniPlayer for mobile - fixed above dock */}
      <div className="fixed bottom-16 left-0 right-0 lg:hidden z-30 px-4 pb-2">
        <MiniPlayer onExpand={() => setDrawerOpen(true)} />
      </div>

      {/* Dock — mobile only */}
      <div className="dock lg:hidden z-40">
        {navItems.map(({ to, labelKey, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              isActive ? 'dock-active text-primary' : 'text-base-content/60'
            }
          >
            <Icon size={22} />
            <span className="dock-label text-xs">{t(labelKey)}</span>
          </NavLink>
        ))}
      </div>

      <AdminModal />
      <ToastHost />
      {drawerOpen && <RemoteDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />}
    </div>
  )
}

