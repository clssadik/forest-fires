import { useRef } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useHarita } from '../../durum/harita'
import { useOlay } from '../../durum/olay'
import { Sahne } from '../../sahne/Sahne'
import { HaritaKontrolleri } from './HaritaKontrolleri'
import { ImlecBilgisi } from './ImlecBilgisi'
import { Pusula } from './Pusula'

/** Harita alanı: 3B/2B sahne ve üstündeki kontroller (docs/02 §4). */
export function Harita() {
  const { t } = useTranslation()
  const kip = useHarita((d) => d.kip)
  const veri = useOlay((d) => d.veri)
  const yukleme = useOlay((d) => d.yukleme)
  const hata = useOlay((d) => d.hata)
  const ref = useRef<HTMLDivElement>(null)
  const tamEkran = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void ref.current?.requestFullscreen()
  }
  return (
    <div ref={ref} className="relative min-h-0 flex-1 overflow-hidden bg-zemin [&_canvas]:cursor-grab [&_canvas:active]:cursor-grabbing">
      {veri ? (
        <>
          {/* Yangın değişince sahne (kamera dahil) yeni bölgeye göre baştan kurulur. */}
          <Sahne key={veri.bilgi.ad} veri={veri} />
          <ImlecBilgisi veri={veri} />
          <Pusula />
          <HaritaKontrolleri veri={veri} tamEkran={tamEkran} />
        </>
      ) : (
        <div className="absolute inset-0 grid place-items-center p-8 text-center text-[13px] text-soluk">
          {yukleme === 'hata' ? (
            <div>
              <p className="font-semibold text-metin">{t('olay.yuklenemedi')}</p>
              <p className="mt-1">{hata}</p>
            </div>
          ) : (
            t('olay.yukleniyor')
          )}
        </div>
      )}
      <p
        className={`pointer-events-none absolute bottom-4 left-4 flex items-center whitespace-nowrap text-[12px] leading-none text-white/80 ${
          kip === '3B' ? '' : 'rounded-md bg-black/70 px-2.5 py-1.5 ring-1 ring-white/10 backdrop-blur-sm'
        }`}
      >
        {kip === '3B' ? (
          <Trans
            i18nKey="harita.ipucu3B"
            components={{
              tus: (
                <kbd className="rounded-[4px] border border-white/25 border-b-white/40 bg-white/10 px-1.5 py-[3px] font-sans backdrop-blur-sm text-[11px] font-medium text-white" />
              ),
            }}
          />
        ) : (
          t('harita.ipucu2B')
        )}
      </p>
    </div>
  )
}
