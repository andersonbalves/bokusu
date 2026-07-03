import { useEffect, useState } from 'react'

export function SplashClock() {
  const [time, setTime] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      data-testid="splash-clock"
      className="text-outlined absolute left-6 top-6 z-20 font-display text-3xl text-white"
    >
      {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </div>
  )
}
