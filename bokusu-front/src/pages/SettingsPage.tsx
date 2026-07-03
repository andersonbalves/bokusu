import { Palette, ShieldCheck, LogOut, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store/useAppStore'
import { setLanguage } from '../lib/i18n'
import { ServerPreferences } from '../components/settings/ServerPreferences'

export function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { theme, setTheme, isAdmin, openAdminModal, setIsAdmin } = useAppStore()

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

      {/* Server Preferences (Admin Only) */}
      {isAdmin && <ServerPreferences />}
    </div>
  )
}


