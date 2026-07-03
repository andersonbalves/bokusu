import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ptBR from '../locales/pt-BR.json'
import en from '../locales/en.json'

const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('bokusu-lang') : null

i18n.use(initReactI18next).init({
  resources: {
    'pt-BR': { translation: ptBR },
    en: { translation: en },
  },
  lng: stored ?? (typeof navigator !== 'undefined' ? navigator.language : 'en'),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export function setLanguage(lang: string) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('bokusu-lang', lang)
  }
  i18n.changeLanguage(lang)
}

export default i18n
