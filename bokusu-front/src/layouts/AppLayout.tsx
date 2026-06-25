import { Outlet, NavLink } from 'react-router-dom'
import { ListMusic, Search, Settings } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { AdminModal } from '../components/AdminModal'

const navItems = [
  { to: '/queue', label: 'Fila', Icon: ListMusic },
  { to: '/search', label: 'Buscar', Icon: Search },
  { to: '/settings', label: 'Configurações', Icon: Settings },
]

export function AppLayout() {
  const theme = useAppStore((state) => state.theme)

  return (
    <div data-theme={theme} className="min-h-screen bg-base-100 text-base-content lg:flex">
      {/* Sidebar — desktop only */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:min-h-screen lg:bg-base-200 lg:border-r lg:border-base-300">
        <div className="p-6">
          <span className="font-display text-2xl text-primary">Bokusu</span>
        </div>
        <nav className="flex-1 px-3">
          <ul className="menu menu-lg gap-1 w-full p-0">
            {navItems.map(({ to, label, Icon }) => (
              <li key={to}>
                <NavLink to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
                  <Icon size={20} />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-20 lg:pb-0">
        <Outlet />
      </main>

      {/* Dock — mobile only (DaisyUI v5 btm-nav replacement) */}
      <div className="dock lg:hidden z-40">
        {navItems.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              isActive ? 'dock-active text-primary' : 'text-base-content/60'
            }
          >
            <Icon size={22} />
            <span className="dock-label text-xs">{label}</span>
          </NavLink>
        ))}
      </div>

      <AdminModal />
    </div>
  )
}
