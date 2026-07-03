import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'
import { setLanguage } from '../../lib/i18n'

export function LanguageSection() {
  const { t, i18n } = useTranslation()

  const currentLanguage = i18n.language.startsWith('pt') ? 'pt-BR' : 'en'

  const handleChange = (lang: string) => {
    setLanguage(lang)
  }

  return (
    <section className="card bg-base-200 border border-base-300">
      <div className="card-body gap-4">
        <div className="flex items-center gap-2">
          <Globe size={18} className="text-primary" />
          <h2 className="font-display text-lg">{t('settings.language')}</h2>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-base-content/70">
            {t('settings.languageSelectDesc') || 'Selecione o idioma da interface de gestão:'}
          </span>
          <select
            className="select select-bordered select-sm w-36 font-semibold"
            value={currentLanguage}
            onChange={(e) => handleChange(e.target.value)}
            aria-label={t('settings.language')}
          >
            <option value="pt-BR">Português</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>
    </section>
  )
}
