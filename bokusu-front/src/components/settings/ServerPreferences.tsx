import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Music, Tv, ListMusic, Star, Settings2, RotateCcw } from 'lucide-react'
import { usePreferences, useSetPreference, useResetPreferences } from '../../hooks/usePreferences'
import { useAppStore } from '../../store/useAppStore'
import { ConfirmModal } from '../ConfirmModal'
import type { Preferences } from '../../types/api'

export function ServerPreferences() {
  const { t } = useTranslation()
  const isAdmin = useAppStore((s) => s.isAdmin)
  const { data: preferences } = usePreferences()
  const resetPreferences = useResetPreferences()

  const [confirmOpen, setConfirmOpen] = useState(false)

  if (!isAdmin || !preferences) return null

  return (
    <div className="flex flex-col gap-6">
      {/* Player Section */}
      <section className="card bg-base-200 border border-base-300">
        <div className="card-body gap-4">
          <div className="flex items-center gap-2 border-b border-base-300 pb-2">
            <Music size={18} className="text-primary" />
            <h2 className="font-display text-lg font-semibold">{t('settings.player')}</h2>
          </div>
          <div className="flex flex-col gap-4">
            <PrefSlider prefKey="volume" label={t('prefs.volume')} min={0} max={1} step={0.01} />
            <PrefNumber prefKey="avsync" label={t('prefs.avsync')} />
            <PrefNumber prefKey="buffer_size" label={t('prefs.buffer_size')} />
            <PrefToggle prefKey="normalize_audio" label={t('prefs.normalize_audio')} />
            <PrefToggle prefKey="complete_transcode_before_play" label={t('prefs.complete_transcode_before_play')} />
            <PrefToggle prefKey="high_quality" label={t('prefs.high_quality')} />
          </div>
        </div>
      </section>

      {/* Splash Section */}
      <section className="card bg-base-200 border border-base-300">
        <div className="card-body gap-4">
          <div className="flex items-center gap-2 border-b border-base-300 pb-2">
            <Tv size={18} className="text-primary" />
            <h2 className="font-display text-lg font-semibold">{t('settings.splash')}</h2>
          </div>
          <div className="flex flex-col gap-4">
            <PrefRadioSplashMode />
            <PrefSlider prefKey="bg_music_volume" label={t('prefs.bg_music_volume')} min={0} max={1} step={0.01} />
            <PrefNumber prefKey="splash_delay" label={t('prefs.splash_delay')} />
            <PrefNumber prefKey="screensaver_timeout" label={t('prefs.screensaver_timeout')} />
            <PrefToggle prefKey="hide_url" label={t('prefs.hide_url')} />
            <PrefToggle prefKey="hide_overlay" label={t('prefs.hide_overlay')} />
            <PrefToggle prefKey="hide_notifications" label={t('prefs.hide_notifications')} />
            <PrefToggle prefKey="show_splash_clock" label={t('prefs.show_splash_clock')} />
            <PrefToggle prefKey="disable_bg_music" label={t('prefs.disable_bg_music')} />
            <PrefToggle prefKey="disable_bg_video" label={t('prefs.disable_bg_video')} />
          </div>
        </div>
      </section>

      {/* Queue Section */}
      <section className="card bg-base-200 border border-base-300">
        <div className="card-body gap-4">
          <div className="flex items-center gap-2 border-b border-base-300 pb-2">
            <ListMusic size={18} className="text-primary" />
            <h2 className="font-display text-lg font-semibold">{t('settings.queue')}</h2>
          </div>
          <div className="flex flex-col gap-4">
            <PrefNumber prefKey="limit_user_songs_by" label={t('prefs.limit_user_songs_by')} />
            <PrefToggle prefKey="enable_fair_queue" label={t('prefs.enable_fair_queue')} />
          </div>
        </div>
      </section>

      {/* Score Section */}
      <section className="card bg-base-200 border border-base-300">
        <div className="card-body gap-4">
          <div className="flex items-center gap-2 border-b border-base-300 pb-2">
            <Star size={18} className="text-primary" />
            <h2 className="font-display text-lg font-semibold">{t('settings.score')}</h2>
          </div>
          <div className="flex flex-col gap-4">
            <PrefToggle prefKey="disable_score" label={t('prefs.disable_score')} />
            <PrefTextarea prefKey="low_score_phrases" label={t('prefs.low_score_phrases')} />
            <PrefTextarea prefKey="mid_score_phrases" label={t('prefs.mid_score_phrases')} />
            <PrefTextarea prefKey="high_score_phrases" label={t('prefs.high_score_phrases')} />
          </div>
        </div>
      </section>

      {/* Advanced Section */}
      <section className="card bg-base-200 border border-base-300">
        <div className="card-body gap-4">
          <div className="flex items-center gap-2 border-b border-base-300 pb-2">
            <Settings2 size={18} className="text-primary" />
            <h2 className="font-display text-lg font-semibold">{t('settings.advanced')}</h2>
          </div>
          <div className="flex flex-col gap-4">
            <PrefNumber prefKey="browse_results_per_page" label={t('prefs.browse_results_per_page')} />
            <PrefToggle prefKey="cdg_pixel_scaling" label={t('prefs.cdg_pixel_scaling')} />
            <PrefToggle prefKey="enable_title_tidy" label={t('prefs.enable_title_tidy')} />
          </div>
        </div>
      </section>

      {/* Reset Defaults */}
      <section className="flex justify-end p-2">
        <button
          type="button"
          className="btn btn-outline btn-error btn-sm flex items-center gap-2"
          onClick={() => setConfirmOpen(true)}
          aria-label={t('settings.restoreDefaults')}
        >
          <RotateCcw size={16} />
          {t('settings.restoreDefaults')}
        </button>
      </section>

      <ConfirmModal
        open={confirmOpen}
        title={t('settings.restoreDefaults')}
        message={t('settings.restoreConfirm')}
        onConfirm={() => {
          resetPreferences.mutate()
          setConfirmOpen(false)
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}

// Local helper component definitions
function PrefToggle({ prefKey, label }: { prefKey: keyof Preferences; label: string }) {
  const { data: preferences } = usePreferences()
  const setPreference = useSetPreference()
  const checked = !!preferences?.[prefKey]

  return (
    <label className="flex items-center justify-between cursor-pointer py-1 hover:bg-base-300/30 px-2 rounded-lg transition-colors">
      <span className="text-sm font-medium text-base-content/85">{label}</span>
      <input
        type="checkbox"
        className="checkbox checkbox-primary checkbox-sm"
        checked={checked}
        onChange={(e) => setPreference.mutate({ key: prefKey, value: e.target.checked } as any)}
        aria-label={label}
      />
    </label>
  )
}

function PrefSlider({ prefKey, label, min, max, step }: { prefKey: keyof Preferences; label: string; min: number; max: number; step: number }) {
  const { data: preferences } = usePreferences()
  const setPreference = useSetPreference()
  const initialValue = (preferences?.[prefKey] as number) ?? min
  const [val, setVal] = useState(initialValue)

  useEffect(() => {
    setVal(initialValue)
  }, [initialValue])

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = (newVal: number) => {
    setVal(newVal)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setPreference.mutate({ key: prefKey, value: newVal } as any)
    }, 300)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <div className="flex flex-col gap-2 w-full py-1 px-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-base-content/85">{label}</span>
        <span className="font-bold text-primary tabular-nums">{Math.round(val * 100)}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={val}
        onChange={(e) => handleChange(parseFloat(e.target.value))}
        className="range range-primary range-xs"
      />
    </div>
  )
}

function PrefNumber({ prefKey, label, min, max }: { prefKey: keyof Preferences; label: string; min?: number; max?: number }) {
  const { data: preferences } = usePreferences()
  const setPreference = useSetPreference()
  const val = (preferences?.[prefKey] as number) ?? ''

  return (
    <div className="flex items-center justify-between gap-4 py-1 hover:bg-base-300/30 px-2 rounded-lg transition-colors">
      <span className="text-sm font-medium text-base-content/85">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        className="input input-bordered input-sm w-24 text-right font-medium"
        value={val}
        onChange={(e) => {
          const num = parseInt(e.target.value)
          if (!isNaN(num)) {
            setPreference.mutate({ key: prefKey, value: num } as any)
          }
        }}
      />
    </div>
  )
}

function PrefTextarea({ prefKey, label }: { prefKey: keyof Preferences; label: string }) {
  const { data: preferences } = usePreferences()
  const setPreference = useSetPreference()
  const initialValue = (preferences?.[prefKey] as string) ?? ''
  const [val, setVal] = useState(initialValue)

  useEffect(() => {
    setVal(initialValue)
  }, [initialValue])

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = (newVal: string) => {
    setVal(newVal)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setPreference.mutate({ key: prefKey, value: newVal } as any)
    }, 400)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <div className="flex flex-col gap-1 w-full py-1 px-2">
      <span className="text-sm font-medium text-base-content/85">{label}</span>
      <textarea
        className="textarea textarea-bordered text-sm w-full h-16 resize-y"
        value={val}
        onChange={(e) => handleChange(e.target.value)}
      />
    </div>
  )
}

function PrefRadioSplashMode() {
  const { t } = useTranslation()
  const { data: preferences } = usePreferences()
  const setPreference = useSetPreference()
  const val = preferences?.splash_display_mode ?? 'integration'

  return (
    <div className="flex flex-col gap-3 py-1 px-2">
      <span className="text-sm font-medium text-base-content/85">{t('prefs.splash_display_mode')}</span>
      <div className="flex flex-col gap-3 pl-2">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            name="splash_display_mode"
            className="radio radio-primary radio-sm mt-0.5"
            checked={val === 'integration'}
            onChange={() => setPreference.mutate({ key: 'splash_display_mode', value: 'integration' })}
          />
          <div>
            <p className="text-sm font-medium text-base-content/85">{t('settings.tvModeIntegration')}</p>
            <p className="text-xs text-base-content/60">{t('settings.tvModeIntegrationDesc')}</p>
          </div>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            name="splash_display_mode"
            className="radio radio-primary radio-sm mt-0.5"
            checked={val === 'cinematic'}
            onChange={() => setPreference.mutate({ key: 'splash_display_mode', value: 'cinematic' })}
          />
          <div>
            <p className="text-sm font-medium text-base-content/85">{t('settings.tvModeCinematic')}</p>
            <p className="text-xs text-base-content/60">{t('settings.tvModeCinematicDesc')}</p>
          </div>
        </label>
      </div>
    </div>
  )
}
