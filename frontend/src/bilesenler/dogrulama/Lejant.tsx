import { useTranslation } from 'react-i18next'
import { FIRMS_DURAKLARI, KARSILASTIRMA_RENKLERI, YAS_DURAKLARI } from '../../dogrulama/boyama'
import { useDogrulama } from '../../durum/dogrulama'

const Kutu = ({ renk }: { renk: string }) => <span className="size-[11px] shrink-0 rounded-[2px]" style={{ background: renk }} />

/** Haritanın sol altındaki açıklama; renk kipine göre değişir. */
export function Lejant() {
  const { t } = useTranslation()
  const renkKipi = useDogrulama((d) => d.renkKipi)
  const katmanlar = useDogrulama((d) => d.katmanlar)

  return (
    <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1.5 rounded-[5px] bg-panel/95 px-3 py-2 text-[12px] shadow-[0_0_0_1px_rgba(120,110,90,0.18),0_2px_6px_rgba(0,0,0,0.08)]">
      {katmanlar.model &&
        (renkKipi === 'yayilim' ? (
          <div>
            <div className="mb-1 font-medium">{t('dogrulama.lejant.yayilim')}</div>
            <div
              className="h-[9px] w-[180px] rounded-[2px]"
              style={{
                background: `linear-gradient(to right, ${YAS_DURAKLARI.map(([, r], i) => `${r} ${(i / (YAS_DURAKLARI.length - 1)) * 100}%`).join(',')})`,
              }}
            />
            <div className="mt-0.5 flex justify-between text-[11px] text-soluk">
              <span>{t('dogrulama.lejant.yeni')}</span>
              <span>{t('dogrulama.lejant.eski')}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="font-medium">{t('dogrulama.lejant.karsilastirma')}</div>
            {(['dogru', 'yanlisAlarm', 'kacirilan'] as const).map((k) => (
              <div key={k} className="flex items-center gap-2">
                <Kutu renk={KARSILASTIRMA_RENKLERI[k]} />
                {t(`dogrulama.karisiklik.${k}`)}
              </div>
            ))}
          </div>
        ))}
      {katmanlar.gercek && (
        <div className="flex items-center gap-2">
          <span className="h-0 w-[14px] border-t-2 border-[#1f1d19]" />
          {t('dogrulama.lejant.gercekSinir')}
        </div>
      )}
      {katmanlar.firms && (
        <div className="flex items-center gap-2">
          <span className="flex gap-0.5">
            {FIRMS_DURAKLARI.map(([, r]) => (
              <span key={r} className="size-[8px] rounded-full border-[0.5px] border-[#1f1d19]" style={{ background: r }} />
            ))}
          </span>
          {t('dogrulama.lejant.firms')}
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="size-[10px] rounded-full border-2 border-[#fffaf0] bg-ates shadow-[0_0_0_1px_rgba(0,0,0,0.2)]" />
        {t('dogrulama.lejant.tutusma')}
      </div>
    </div>
  )
}
