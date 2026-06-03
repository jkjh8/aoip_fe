import { defineBoot } from '#q-app/wrappers'
import { createI18n } from 'vue-i18n'
import { Quasar } from 'quasar'
import messages from 'src/i18n'

const STORAGE_KEY = 'aoip.locale'
const DEFAULT_LOCALE = 'en-US'

function loadLocale() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v && messages[v]) return v
  } catch {
    // ignore
  }
  return DEFAULT_LOCALE
}

const initial = loadLocale()

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: initial,
  fallbackLocale: DEFAULT_LOCALE,
  messages,
})

async function applyQuasarLang(locale) {
  try {
    const code = locale === 'ko-KR' ? 'ko-KR' : 'en-US'
    const lang = await import(`quasar/lang/${code}.mjs`)
    Quasar.lang.set(lang.default)
  } catch {
    // ignore — fall back to default
  }
}

export function setLocale(locale) {
  if (!messages[locale]) return
  i18n.global.locale.value = locale
  try { localStorage.setItem(STORAGE_KEY, locale) } catch {
    // ignore
  }
  applyQuasarLang(locale)
}

applyQuasarLang(initial)

export default defineBoot(({ app }) => {
  app.use(i18n)
})
