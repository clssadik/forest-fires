import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import tr from './tr.json'

// Tüm arayüz metinleri çeviri dosyalarındadır. İngilizce için en.json eklenip
// resources'a yazılması yeterli.
void i18n.use(initReactI18next).init({
  resources: { tr: { translation: tr } },
  lng: 'tr',
  fallbackLng: 'tr',
  interpolation: { escapeValue: false },
})

export default i18n
