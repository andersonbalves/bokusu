import { Tv, Palette, ShieldCheck, LogOut, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store/useAppStore'
import { usePreferences, useSetPreference } from '../hooks/usePreferences'
import { setLanguage } from '../lib/i18n'

export function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { theme, setTheme, isAdmin, openAdminModal, setIsAdmin } = useAppStore()
  const { data: preferences } = usePreferences()
  const setPreference = useSetPreference()
  const playerMode = preferences?.splash_display_mode ?? 'integration'
  const setPlayerMode = (mode: 'integration' | 'cinematic') => {
    if (!isAdmin) {
      openAdminModal(() =>
        setPreference.mutate({ key: 'splash_display_mode', value: mode })
      )
      return
    }
    setPreference.mutate({ key: 'splash_display_mode', value: mode })
  }

  return (
    <div className="p-4 max-w-2xl mx-auto flex flex-col gap-6">
      {/* Theme */}
      <section className="card bg-base-200 border border-base-300">
        <div className="card-body gap-4">
          <div className="flex items-center gap-2">
            <Palette size={18} className="text-primary" />
            <h2 className="font-display text-lg">{t('settings.theme')}</h2>
          </div>
          <div className="flex gap-6">
            {(['aqua', 'acid'] as const).map((themeName) => (
              <label key={themeName} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  className="radio radio-primary"
                  name="theme"
                  value={themeName}
                  checked={theme === themeName}
                  onChange={() => setTheme(themeName)}
                  aria-label={t(`settings.${themeName}` as any)}
                />
                <span className="capitalize">{t(`settings.${themeName}` as any)}</span>
              </label>
            ))}
          </div>
        </div>
      </section>

      {/* Language */}
      <section className="card bg-base-200 border border-base-300">
        <div className="card-body gap-4">
          <div className="flex items-center gap-2">
            <Globe size={18} className="text-primary" />
            <h2 className="font-display text-lg">{t('settings.language')}</h2>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                className="radio radio-primary"
                name="language"
                value="pt-BR"
                checked={i18n.language === 'pt-BR'}
                onChange={() => setLanguage('pt-BR')}
                aria-label="Português"
              />
              <span>Português</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                className="radio radio-primary"
                name="language"
                value="en"
                checked={i18n.language.startsWith('en')}
                onChange={() => setLanguage('en')}
                aria-label="English"
              />
              <span>English</span>
            </label>
          </div>
        </div>
      </section>

      {/* TV / Player Mode */}
      <section className="card bg-base-200 border border-base-300">
        <div className="card-body gap-4">
          <div className="flex items-center gap-2">
            <Tv size={18} className="text-primary" />
            <h2 className="font-display text-lg">{t('settings.tvMode')}</h2>
          </div>
          <div className="flex flex-col gap-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                className="radio radio-primary mt-0.5"
                name="playerMode"
                value="integration"
                checked={playerMode === 'integration'}
                onChange={() => setPlayerMode('integration')}
                aria-label={t('settings.tvModeIntegration')}
              />
              <div>
                <p className="font-medium">{t('settings.tvModeIntegration')}</p>
                <p className="text-sm text-base-content/60">
                  {t('settings.tvModeIntegrationDesc')}
                </p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                className="radio radio-primary mt-0.5"
                name="playerMode"
                value="cinematic"
                checked={playerMode === 'cinematic'}
                onChange={() => setPlayerMode('cinematic')}
                aria-label={t('settings.tvModeCinematic')}
              />
              <div>
                <p className="font-medium">{t('settings.tvModeCinematic')}</p>
                <p className="text-sm text-base-content/60">
                  {t('settings.tvModeCinematicDesc')}
                </p>
              </div>
            </label>
          </div>
        </div>
      </section>

      {/* Admin */}
      <section className="card bg-base-200 border border-base-300">
        <div className="card-body gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-primary" />
            <h2 className="font-display text-lg">{t('settings.admin')}</h2>
          </div>
          {isAdmin ? (
            <div className="flex items-center justify-between">
              <span className="badge badge-success gap-1">
                <ShieldCheck size={12} />
                {t('settings.adminActive')}
              </span>
              <button
                className="btn btn-sm btn-outline btn-error"
                onClick={() => setIsAdmin(false)}
                aria-label={t('settings.adminLogout')}
              >
                <LogOut size={16} />
                {t('settings.adminLogout')}
              </button>
            </div>
          ) : (
            <button
              className="btn btn-outline btn-primary w-fit"
              onClick={() => openAdminModal(() => {})}
              aria-label={t('settings.adminLogin')}
            >
              <ShieldCheck size={16} />
              {t('settings.adminLogin')}
            </button>
          )}
        </div>
      </section>
    </div>
  )
}

