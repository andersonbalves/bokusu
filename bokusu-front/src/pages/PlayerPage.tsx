import { QRCodeSVG } from 'qrcode.react'
import { usePreferences } from '../hooks/usePreferences'
import { useQueue } from '../hooks/useQueue'
import type { Song } from '../types/api'

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
  const { data: songs = [] } = useQueue()

  const nowPlaying: Song | undefined = songs[0]
  const upcoming = songs.slice(1, 4)

  if (playerMode === 'integration') {
    return <IntegrationMode appUrl={appUrl} upcoming={upcoming} />
  }
  return <CinematicMode appUrl={appUrl} nowPlaying={nowPlaying} upcoming={upcoming} />
}

function IntegrationMode({ appUrl, upcoming }: { appUrl: string; upcoming: Song[] }) {
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
          {upcoming.map((song) => (
            <p key={song.id} className="text-outlined text-white/80 text-base">
              {song.title}
              {song.singerName && (
                <span className="text-outlined text-white/50"> — {song.singerName}</span>
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
  nowPlaying,
  upcoming,
}: {
  appUrl: string
  nowPlaying: Song | undefined
  upcoming: Song[]
}) {
  const host = extractHost(appUrl)

  return (
    <div className="w-full h-full relative">
      {/* Top-left: Now Playing */}
      {nowPlaying && (
        <div className="absolute top-6 left-6 max-w-sm">
          <p className="text-outlined text-white/50 text-xs uppercase tracking-widest mb-1">
            Tocando
          </p>
          <p className="text-outlined font-display text-2xl text-white">{nowPlaying.title}</p>
          {nowPlaying.singerName && (
            <p className="text-outlined text-white/70 text-sm">{nowPlaying.singerName}</p>
          )}
        </div>
      )}

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
