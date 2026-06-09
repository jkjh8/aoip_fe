import { defineBoot } from '#q-app/wrappers'
import { createI18n } from 'vue-i18n'
import { Quasar } from 'quasar'
import messages from 'src/i18n'
import quasarEnUS from 'quasar/lang/en-US'
import quasarKoKR from 'quasar/lang/ko-KR'

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

function applyQuasarLang(locale) {
  Quasar.lang.set(locale === 'ko-KR' ? quasarKoKR : quasarEnUS)
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
