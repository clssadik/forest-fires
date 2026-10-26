import { useMemo, useRef, type PointerEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { gunAy, gunAySaat, saat } from '../../bicim'
import { useZaman } from '../../durum/zaman'
import type { OnemliOlay } from '../../olay/veri'
import { IkonAsagi, IkonDuraklat, IkonIleri, IkonOynat } from '../ikonlar'
import { OlayIkonu } from '../OlayIkonu'

const SAAT = 3_600_000
const HIZLAR = [1, 2, 5, 10, 30]
/** 1× oynatma hızı: gerçek saniye başına simülasyon dakikası. */
const TEMEL_HIZ = 60

interface Ozellikler {
  /** Kırmızı bandın yoğunluğu (ör. yayılma hızı). */
  yogunluk: (t: number) => number
  /** Çubuk üzerindeki olay işaretleri. */
  olaylar: OnemliOlay[]
}

/** Zaman çubuğu: oynat/duraklat/ileri, hız, gün tikleri, olay işaretleri, sürüklenebilir imleç (docs/02 §8). */
export function ZamanCubugu({ yogunluk, olaylar }: Ozellikler) {
  const { t } = useTranslation()
  const { baslangic, bitis, oynatiliyor, hiz } = useZaman()
  const zaman = useZaman((d) => d.t)
  const { oynatDuraklat, zamanaGit, hizAyarla } = useZaman.getState()

  const oran = (x: number) => (x - baslangic) / Math.max(bitis - baslangic, 1)
  const yuzde = (x: number) => `${oran(x) * 100}%`

  return (
    <div className="relative flex h-[100px] shrink-0 border-b border-cizgi">
      <div className="flex w-[222px] shrink-0 flex-col justify-between px-3.5 pt-2 pb-3">
        <h2 className="text-[14px] font-semibold">{t('zaman.baslik')}</h2>
        <div className="flex items-center gap-1.5">
          <Dugme etiket={t('zaman.oynat')} etkin={oynatiliyor} onClick={() => !oynatiliyor && oynatDuraklat()}>
            <IkonOynat boyut={14} />
          </Dugme>
          <Dugme etiket={t('zaman.duraklat')} etkin={!oynatiliyor} onClick={() => oynatiliyor && oynatDuraklat()}>
            <IkonDuraklat boyut={14} />
          </Dugme>
          <Dugme etiket={t('zaman.ileri')} onClick={() => zamanaGit(useZaman.getState().t + SAAT)} pasif={zaman >= bitis}>
            <IkonIleri boyut={13} />
          </Dugme>
          <label className="relative ml-1.5">
            <span className="sr-only">{t('zaman.hiz')}</span>
            <select
              value={Math.round(hiz / TEMEL_HIZ)}
              onChange={(e) => hizAyarla(Number(e.target.value) * TEMEL_HIZ)}
              className="h-[38px] w-[56px] appearance-none rounded-[5px] border border-cizgi bg-[#e4e0d5] pl-2.5 text-[12.5px] shadow-[0_1px_1px_rgba(0,0,0,0.06)]"
            >
              {HIZLAR.map((h) => (
                <option key={h} value={h}>
                  {h}×
                </option>
              ))}
            </select>
            <IkonAsagi boyut={11} className="pointer-events-none absolute top-[13.5px] right-2 text-soluk" />
          </label>
        </div>
      </div>

      <div className="relative flex-1 pr-5">
        <span className="absolute top-2 right-5 text-[12.5px]">
          {gunAySaat(baslangic)} – {gunAySaat(bitis)}
        </span>
        <Iz
          baslangic={baslangic}
          bitis={bitis}
          zaman={zaman}
          yuzde={yuzde}
          oran={oran}
          yogunluk={yogunluk}
          olaylar={olaylar}
        />
      </div>
    </div>
  )
}

function Iz({
  baslangic,
  bitis,
  zaman,
  yuzde,
  oran,
  yogunluk,
  olaylar,
}: {
  yogunluk: (t: number) => number
  olaylar: OnemliOlay[]
  baslangic: number
  bitis: number
  zaman: number
  yuzde: (x: number) => string
  oran: (x: number) => number
}) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const zamanaGit = useZaman((d) => d.zamanaGit)

  const tikler = useMemo(() => {
    const sonuc: { x: number; gun: boolean }[] = []
    // İlk yerel 00:00 / 12:00'den başla (TSİ = UTC+3).
    let x = Math.ceil((baslangic + 3 * SAAT) / (12 * SAAT)) * 12 * SAAT - 3 * SAAT
    for (; x <= bitis; x += 6 * SAAT) {
      const yerel = ((x + 3 * SAAT) / SAAT) % 24
      sonuc.push({ x, gun: yerel === 0 })
    }
    return sonuc
  }, [baslangic, bitis])

  // Yayılma hızına göre yoğunlaşan kırmızı bant.
  const bant = useMemo(() => {
    const duraklar: string[] = []
    const n = 80
    let enBuyuk = 0
    const degerler = Array.from({ length: n + 1 }, (_, i) => {
      const v = yogunluk(baslangic + ((bitis - baslangic) * i) / n)
      enBuyuk = Math.max(enBuyuk, v)
      return v
    })
    degerler.forEach((v, i) => {
      const a = v > 0 ? 0.18 + 0.62 * Math.sqrt(v / enBuyuk) : 0
      duraklar.push(`rgba(220,90,70,${a.toFixed(2)}) ${((i / n) * 100).toFixed(1)}%`)
    })
    return `linear-gradient(to right, ${duraklar.join(',')})`
  }, [baslangic, bitis, yogunluk])

  const sec = (e: PointerEvent) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const o = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1)
    zamanaGit(baslangic + o * (bitis - baslangic))
  }

  return (
    <div
      ref={ref}
      className="absolute inset-x-0 top-[22px] bottom-0 mr-5 cursor-pointer touch-none select-none"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        sec(e)
      }}
      onPointerMove={(e) => e.buttons === 1 && sec(e)}
      role="slider"
      aria-label={t('zaman.imlec')}
      aria-valuemin={baslangic}
      aria-valuemax={bitis}
      aria-valuenow={zaman}
      aria-valuetext={gunAySaat(zaman)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') zamanaGit(zaman + SAAT)
        if (e.key === 'ArrowLeft') zamanaGit(zaman - SAAT)
      }}
    >
      {/* Ana çizgi */}
      <div className="absolute inset-x-0 top-[9px] h-[3px] rounded bg-[#77716a]" />
      {/* Yoğunluk bandı: geçmiş tam, gelecek soluk */}
      <div className="absolute inset-x-0 top-[13px] h-[6px] opacity-45" style={{ background: bant }} />
      <div
        className="absolute left-0 top-[13px] h-[6px]"
        style={{ backgroundImage: bant, width: yuzde(zaman), backgroundSize: `${100 / Math.max(oran(zaman), 0.001)}% 100%` }}
      />
      {/* Olay işaretleri */}
      {olaylar.map((o) => (
        <span
          key={`${o.tur}-${o.zaman}`}
          className={`absolute top-[18px] -translate-x-1/2 ${o.zaman > zaman ? 'opacity-60' : ''}`}
          style={{ left: yuzde(o.zaman) }}
        >
          <OlayIkonu tur={o.tur} boyut={11} />
        </span>
      ))}
      {/* Tikler */}
      {tikler.map(({ x, gun }) => {
        const yerel = ((x + 3 * SAAT) / SAAT) % 24
        const etiketli = yerel % 12 === 0
        return (
          <div key={x} className="absolute top-[30px] -translate-x-1/2 text-center" style={{ left: yuzde(x) }}>
            <div className={`mx-auto w-px bg-[#9a9385] ${etiketli ? 'h-[5px]' : 'h-[3px]'}`} />
            {etiketli && (
              <div className="mt-0.5 leading-[15px] whitespace-nowrap">
                <div className={`text-[12.5px] font-semibold ${gun ? '' : 'invisible'}`}>{gunAy(x)}</div>
                <div className="text-[12px] text-[#4d483f]">{saat(x)}</div>
              </div>
            )}
          </div>
        )
      })}
      {/* İmleç */}
      <div className="pointer-events-none absolute top-0 -translate-x-1/2" style={{ left: yuzde(zaman) }}>
        {/* Etiket ortalanır; uçlara yaklaşınca çubuğun dışına taşmasın diye içeri kayar. */}
        <div
          className="absolute bottom-[calc(100%+4px)] left-1/2 rounded-[4px] bg-[#2f2c27] px-2 py-[3px] text-[12.5px] whitespace-nowrap text-white shadow"
          style={{ transform: `translateX(-${etiketKaymasi(oran(zaman))}%)` }}
        >
          {gunAySaat(zaman)}
        </div>
        <div className="size-[20px] rounded-full border-[3px] border-[#e9e5da] bg-[#4a463e] shadow-[0_1px_3px_rgba(0,0,0,0.35)]" />
      </div>
    </div>
  )
}

/** İmleç etiketinin yatay kayması (%): ortada 50, uçlarda 0 / 100. */
const etiketKaymasi = (o: number) => (o < 0.5 ? Math.min(o / 0.05, 1) * 50 : 100 - Math.min((1 - o) / 0.05, 1) * 50)

function Dugme({
  etiket,
  etkin = false,
  pasif = false,
  onClick,
  children,
}: {
  etiket: string
  etkin?: boolean
  pasif?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={etiket}
      aria-label={etiket}
      aria-pressed={etkin}
      disabled={pasif}
      onClick={onClick}
      className={`grid size-[38px] place-items-center rounded-[5px] border shadow-[0_1px_1px_rgba(0,0,0,0.08)] ${
        etkin ? 'border-koyu bg-koyu text-white' : 'border-cizgi bg-[#e4e0d5] text-[#2f2c27] hover:bg-[#ebe7dc]'
      } ${pasif ? 'opacity-40' : ''}`}
    >
      {children}
    </button>
  )
}
