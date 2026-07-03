import i18n from './i18n'
import { test, expect } from 'vitest'

test('resolves pt-BR and en keys', () => {
  i18n.changeLanguage('pt-BR')
  expect(i18n.t('nav.queue')).toBe('Fila')
  i18n.changeLanguage('en')
  expect(i18n.t('nav.queue')).toBe('Queue')
})
