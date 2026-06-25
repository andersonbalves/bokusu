import { Outlet } from 'react-router-dom'

export function PlayerLayout() {
  return (
    <div className="w-screen h-screen bg-black text-white overflow-hidden">
      <Outlet />
    </div>
  )
}
