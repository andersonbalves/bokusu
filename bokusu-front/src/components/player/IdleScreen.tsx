import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { QRCodeSVG } from 'qrcode.react'
import { extractHost } from '../../lib/url'
import { BackgroundMedia } from './BackgroundMedia'
import { Screensaver } from './Screensaver'
import { SplashClock } from './SplashClock'
import type { QueueItem } from '../../types/api'

interface IdleScreenProps {
  appUrl: string
  mode: 'integration' | 'cinematic'
  upcoming: QueueItem[]
  hideUrl: boolean
  showClock: boolean
  screensaverTimeout: number
  disableBgMusic: boolean
  disableBgVideo: boolean
  bgMusicVolume: number
  isLoading: boolean
}

export function IdleScreen({
  appUrl,
  mode,
  upcoming,
  hideUrl,
  showClock,
  screensaverTimeout,
  disableBgMusic,
  disableBgVideo,
  bgMusicVolume,
  isLoading,
}: IdleScreenProps) {
  const { t } = useTranslation()
  const [screensaverActive, setScreensaverActive] = useState(false)

  // Screensaver: ativa após screensaverTimeout segundos ociosos; qualquer
  // mudança de fila/loading reinicia a contagem (mudança de estado desmonta a tela)
  useEffect(() => {
    setScreensaverActive(false)
    if (screensaverTimeout <= 0 || isLoading) return
    const timer = setTimeout(() => setScreensaverActive(true), screensaverTimeout * 1000)
    return () => clearTimeout(timer)
  }, [screensaverTimeout, isLoading, upcoming])

  return (
    <div className="relative h-full w-full overflow-hidden">
      <BackgroundMedia
        active={!isLoading}
        disableBgMusic={disableBgMusic}
        disableBgVideo={disableBgVideo}
        bgMusicVolume={bgMusicVolume}
      />
      {mode === 'integration' ? (
        <IntegrationMode appUrl={appUrl} upcoming={upcoming} hideUrl={hideUrl} t={t} />
      ) : (
        <CinematicMode appUrl={appUrl} upcoming={upcoming} hideUrl={hideUrl} t={t} />
      )}
      {showClock && <SplashClock />}
      {isLoading && (
        <div
          data-testid="player-loading"
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/60"
        >
          <span className="loading loading-spinner loading-lg text-white" />
        </div>
      )}
      {screensaverActive && <Screensaver appUrl={appUrl} hideUrl={hideUrl} />}
    </div>
  )
}

function IntegrationMode({
  appUrl,
  upcoming,
  hideUrl,
  t,
}: {
  appUrl: string
  upcoming: QueueItem[]
  hideUrl: boolean
  t: (key: string) => string
}) {
  const host = extractHost(appUrl)

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-8 p-8">
      {!hideUrl && (
        <div data-testid="qr-code" className="bg-white p-4 rounded-2xl shadow-2xl">
          <QRCodeSVG value={appUrl} size={256} />
        </div>
      )}

      {!hideUrl && (
        <div className="text-center">
          <p className="text-outlined font-display text-4xl font-bold tracking-wide text-white">
            {t('player.scanToSing')}
          </p>
          <p className="text-outlined text-white/70 text-xl mt-2">{host}</p>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="flex flex-col items-center gap-2 mt-2">
          <p className="text-outlined text-white/40 text-xs uppercase tracking-widest">{t('player.upNext')}</p>
          {upcoming.map((item, index) => (
            <p key={`${item.file}-${index}`} className="text-outlined text-white/80 text-base">
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
  hideUrl,
  t,
}: {
  appUrl: string
  upcoming: QueueItem[]
  hideUrl: boolean
  t: (key: string) => string
}) {
  const host = extractHost(appUrl)

  return (
    <div className="w-full h-full relative">
      {!hideUrl && (
        <>
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
        </>
      )}

      {/* Bottom-right: upcoming ticker */}
      {upcoming.length > 0 && (
        <div className="absolute bottom-6 right-6 max-w-xs text-right">
          <p className="text-outlined text-white/40 text-xs uppercase tracking-widest mb-1">
            {t('player.upNext')}
          </p>
          <p className="text-outlined text-white/60 text-sm truncate">
            {upcoming.map((s) => s.title).join(' · ')}
          </p>
        </div>
      )}
    </div>
  )
}
