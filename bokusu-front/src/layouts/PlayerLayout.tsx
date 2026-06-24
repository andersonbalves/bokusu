import { Outlet } from 'react-router-dom'

export function PlayerLayout() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <Outlet />
    </div>
  )
}
