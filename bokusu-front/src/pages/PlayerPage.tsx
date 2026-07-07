import { useTranslation } from 'react-i18next'
import { QRCodeSVG } from 'qrcode.react'
import { extractHost } from '../lib/url'
import { useNowPlaying } from '../hooks/useNowPlaying'
import { usePreferences } from '../hooks/usePreferences'
import { useQueue } from '../hooks/useQueue'
import { useScorePhrases } from '../hooks/useScorePhrases'
import { useSplashRole } from '../hooks/useSplashRole'
import { useConnectionInfo } from '../hooks/useSystem'
import { usePlayerStateMachine } from '../hooks/usePlayerStateMachine'
import { IdleScreen } from '../components/player/IdleScreen'
import { KaraokePlayer } from '../components/player/KaraokePlayer'
import { NotificationBanner } from '../components/player/NotificationBanner'
import { ScoreScreen } from '../components/player/ScoreScreen'
import { Mic } from 'lucide-react'
import type { NowPlaying, ScorePhrases } from '../types/api'

const EMPTY_PHRASES: ScorePhrases = { low: [], mid: [], high: [] }

interface PlayerPageProps {
  appUrl?: string
}

export function PlayerPage({ appUrl }: PlayerPageProps) {
  const { data: nowPlaying } = useNowPlaying()
  const { data: preferences } = usePreferences()
  const { data: phrases } = useScorePhrases()
  const { data: queue = [] } = useQueue()
  const { data: connectionInfo } = useConnectionInfo()
  const role = useSplashRole()
  const isMaster = role !== 'slave' // enquanto o servidor não responde, age como master (tela única)
  const effectiveAppUrl = appUrl ?? connectionInfo?.url ?? window.location.origin

  const machine = usePlayerStateMachine({
    nowPlayingUrl: nowPlaying?.now_playing_url ?? null,
    disableScore: preferences?.disable_score ?? false,
    isMaster,
  })

  return (
    <div className="relative h-full w-full">
      {(machine.state === 'idle' || machine.state === 'loading') && (
        <IdleScreen
          appUrl={effectiveAppUrl}
          mode={preferences?.splash_display_mode ?? 'integration'}
          upcoming={queue.slice(0, 3)}
          hideUrl={preferences?.hide_url ?? false}
          showClock={preferences?.show_splash_clock ?? false}
          screensaverTimeout={preferences?.screensaver_timeout ?? 0}
          disableBgMusic={preferences?.disable_bg_music ?? false}
          disableBgVideo={preferences?.disable_bg_video ?? false}
          bgMusicVolume={preferences?.bg_music_volume ?? 0.5}
          isLoading={machine.state === 'loading'}
        />
      )}

      {(machine.state === 'loading' || machine.state === 'playing') &&
        machine.mediaUrl &&
        nowPlaying && (
          <div className={machine.state === 'playing' ? 'absolute inset-0' : 'invisible absolute inset-0'}>
            <KaraokePlayer
              url={machine.mediaUrl}
              subtitleUrl={nowPlaying.now_playing_subtitle_url}
              isPaused={nowPlaying.is_paused}
              volume={nowPlaying.volume}
              isMaster={isMaster}
              onCanPlay={machine.handleCanPlay}
              onEnded={machine.handleEnded}
              onError={machine.handleError}
            />
            {machine.state === 'playing' && !(preferences?.hide_overlay ?? false) && (
              <PlayingOverlay
                nowPlaying={nowPlaying}
                appUrl={effectiveAppUrl}
                hideUrl={preferences?.hide_url ?? false}
              />
            )}
          </div>
        )}

      {machine.state === 'scoring' && (
        <ScoreScreen phrases={phrases ?? EMPTY_PHRASES} onFinished={machine.handleScoreFinished} />
      )}

      <NotificationBanner
        isMaster={isMaster}
        hideNotifications={preferences?.hide_notifications ?? false}
      />
    </div>
  )
}

function PlayingOverlay({
  nowPlaying,
  appUrl,
  hideUrl,
}: {
  nowPlaying: NowPlaying
  appUrl: string
  hideUrl: boolean
}) {
  const { t } = useTranslation()
  const host = extractHost(appUrl)
  return (
    <>
      <div className="absolute left-6 top-6 z-30">
        <p className="text-outlined text-3xl font-bold text-white mb-1">{nowPlaying.now_playing}</p>
        {nowPlaying.now_playing_user && (
          <p className="text-outlined text-xl font-bold text-white flex items-center gap-2">
            <Mic className="w-5 h-5" /> {nowPlaying.now_playing_user}
          </p>
        )}
      </div>
      
      {!hideUrl && (
        <div className="absolute bottom-6 left-6 z-30 flex items-center gap-4">
          <div className="bg-white p-2 rounded-lg shadow-lg">
            <QRCodeSVG value={appUrl} size={64} />
          </div>
          <p className="text-outlined text-white font-mono text-lg">{host}</p>
        </div>
      )}

      {nowPlaying.up_next && (
        <div className="absolute bottom-6 right-6 z-30 text-right">
          <p className="text-outlined text-white font-bold mb-1">
            {t('player.upNext')} <span className="font-normal">{nowPlaying.up_next}</span>
          </p>
          {nowPlaying.next_user && (
            <p className="text-outlined text-white font-bold">
              {t('player.nextSinger')} <span className="font-normal">{nowPlaying.next_user}</span>
            </p>
          )}
        </div>
      )}
    </>
  )
}
