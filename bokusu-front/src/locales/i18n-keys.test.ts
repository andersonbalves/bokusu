import { describe, expect, test } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import en from './en.json'
import ptBR from './pt-BR.json'

function flatten(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? flatten(value as Record<string, unknown>, `${prefix}${key}.`)
      : [`${prefix}${key}`]
  )
}

function usedKeys(): string[] {
  const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const keys = new Set<string>()
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) {
        const source = fs.readFileSync(full, 'utf-8')
        for (const match of source.matchAll(/\bt\(\s*['"]([\w.]+)['"]/g)) keys.add(match[1])
      }
    }
  }
  walk(srcDir)
  return [...keys]
}

describe('locale completeness', () => {
  const locales = { en: flatten(en), 'pt-BR': flatten(ptBR) }
  for (const [name, keys] of Object.entries(locales)) {
    test(`every t() key exists in ${name}`, () => {
      const missing = usedKeys().filter((k) => !keys.includes(k))
      expect(missing).toEqual([])
    })
  }
})
