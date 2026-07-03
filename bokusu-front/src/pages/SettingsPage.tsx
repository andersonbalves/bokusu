import { Palette, ShieldCheck, LogOut, Library } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { ServerPreferences } from '../components/settings/ServerPreferences'
import { SystemPanel } from '../components/settings/SystemPanel'
import { LanguageSection } from '../components/settings/LanguageSection'

export function SettingsPage() {
  const { t } = useTranslation()
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

      {/* Language Section */}
      <LanguageSection />

      {/* Admin */}
      <section className="card bg-base-200 border border-base-300">
        <div className="card-body gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-primary" />
            <h2 className="font-display text-lg">{t('settings.admin')}</h2>
          </div>
          {isAdmin ? (
            <div className="flex flex-col gap-4">
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
              <div className="border-t border-base-300 pt-3 flex justify-end">
                <Link to="/library" className="btn btn-sm btn-primary flex items-center gap-1.5" aria-label={t('settings.manageLibrary')}>
                  <Library size={14} />
                  {t('settings.manageLibrary') || 'Gerenciar Biblioteca'}
                </Link>
              </div>
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

      {/* System Panel (Admin Only) */}
      {isAdmin && <SystemPanel />}
    </div>
  )
}


