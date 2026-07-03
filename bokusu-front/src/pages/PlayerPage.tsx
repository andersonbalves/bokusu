import { QRCodeSVG } from 'qrcode.react'
import { usePreferences } from '../hooks/usePreferences'
import { useQueue } from '../hooks/useQueue'
import type { QueueItem } from '../types/api'

interface PlayerPageProps {
  appUrl?: string
}

function extractHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

export function PlayerPage({ appUrl = window.location.origin }: PlayerPageProps) {
  const { data: preferences } = usePreferences()
  const playerMode = preferences?.splash_display_mode ?? 'integration'
  const { data: queue = [] } = useQueue()

  const upcoming = queue.slice(0, 3)

  if (playerMode === 'integration') {
    return <IntegrationMode appUrl={appUrl} upcoming={upcoming} />
  }
  return <CinematicMode appUrl={appUrl} upcoming={upcoming} />
}

function IntegrationMode({ appUrl, upcoming }: { appUrl: string; upcoming: QueueItem[] }) {
  const host = extractHost(appUrl)

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-8 p-8">
      <div data-testid="qr-code" className="bg-white p-4 rounded-2xl shadow-2xl">
        <QRCodeSVG value={appUrl} size={256} />
      </div>

      <div className="text-center">
        <p className="text-outlined font-display text-4xl font-bold tracking-wide text-white">
          Escaneie para cantar
        </p>
        <p className="text-outlined text-white/70 text-xl mt-2">{host}</p>
      </div>

      {upcoming.length > 0 && (
        <div className="flex flex-col items-center gap-2 mt-2">
          <p className="text-outlined text-white/40 text-xs uppercase tracking-widest">A seguir</p>
          {upcoming.map((item) => (
            <p key={item.file} className="text-outlined text-white/80 text-base">
              {item.title}
              {item.user && (
                <span className="text-outlined text-white/50"> — {item.user}</span>
              )}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

function CinematicMode({
  appUrl,
  upcoming,
}: {
  appUrl: string
  upcoming: QueueItem[]
}) {
  const host = extractHost(appUrl)

  return (
    <div className="w-full h-full relative">
      {/* Top-right: small QR */}
      <div className="absolute top-6 right-6" data-testid="qr-code">
        <div className="bg-white p-2 rounded-lg shadow-lg">
          <QRCodeSVG value={appUrl} size={80} />
        </div>
      </div>

      {/* Bottom-left: IP address */}
      <div className="absolute bottom-6 left-6">
        <p className="text-outlined text-white/50 text-sm font-mono">{host}</p>
      </div>

      {/* Bottom-right: upcoming ticker */}
      {upcoming.length > 0 && (
        <div className="absolute bottom-6 right-6 max-w-xs text-right">
          <p className="text-outlined text-white/40 text-xs uppercase tracking-widest mb-1">
            A seguir
          </p>
          <p className="text-outlined text-white/60 text-sm truncate">
            {upcoming.map((s) => s.title).join(' · ')}
          </p>
        </div>
      )}
    </div>
  )
}
