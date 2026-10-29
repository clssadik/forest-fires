import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { gunAy, gunAySaat, saat as saatBicim, sayi, yuzdeBicim } from '../../bicim'
import { useHarita } from '../../durum/harita'
import { useOlay } from '../../durum/olay'
import { useZaman } from '../../durum/zaman'
import { useBoyut } from '../../kancalar/useBoyut'
import { guzelUst, kirpilmisUst } from '../../olay/olcek'
import { pusulaYonu, type OlayVerisi, type OnemliOlay } from '../../olay/veri'
import { olayOzeti } from '../altSerit/OnemliOlaylar'
import { OlayIkonu } from '../OlayIkonu'
import {
  IkonAsagi,
  IkonDuraklat,
  IkonIleri,
  IkonOynat,
} from '../ikonlar'

const SAAT = 3_600_000
const DAKIKA = 60_000
const HIZLAR = [1, 2, 5, 10, 30]
/** 1× oynatma hızı: gerçek saniye başına simülasyon dakikası. */
const TEMEL_HIZ = 60
/** Şerit adlarının sütunu ve grafiklerin sağ boşluğu (px). */
const ETIKET = 212
const SAG = 16

/** Olaylar şeridi: tutuşma turuncu, diğerleri gri; bu kadar pikselden yakın olaylar tek işarette toplanır. */
const ONEMLI_RENK = '#ec5a3a'
const OLAY_RENGI = '#8c8c8c'
const TOPLAMA_PX = 14

interface Seri {
  ys: number[]
  renk: string
  dolgu?: string
  kesik?: boolean
  /** Seçili andaki değer; etiket sütununda serinin çizgi örneğiyle yazılır. */
  deger: string
  /** Etiket sütunundaki adı; yoksa şeridin adı. */
  etiket?: string
}

interface Serit {
  kimlik: string
  ad: string
  yuk: number
  ust: number
  seriler: Seri[]
}

/**
 * Olay ekranının alt paneli: oynatma denetimleri ve aynı zaman ekseninde alt alta şeritler.
 * Şeritler her zaman açık: olaylar, yanan alan, cephe hızı, rüzgâr, sıcaklık, nem ve yakıt nemi.
 * Şeritlerin üstüne tıklamak ya da sürüklemek zamanı o ana götürür; beyaz çizgi seçili an, tarihi
 * olaylar satırının solunda. Birbirine yakın olaylar tek işarette toplanır. Şeritler
 * baştan sona aynı parlaklıkta çizilir (karşılaştırma için); geçmiş/gelecek ayrımını imleç yapar.
 */
export function ZamanPaneli({ veri }: { veri: OlayVerisi | null }) {
  return (
    <section className="shrink-0 border-t border-cizgi bg-olaylar">
      <div className="flex h-[50px] items-center gap-2 border-b border-cizgi px-3.5 whitespace-nowrap">
        <Denetimler />
      </div>
      {veri && <Seritler veri={veri} />}
    </section>
  )
}

function Denetimler() {
  const { t } = useTranslation()
  const { bitis, oynatiliyor, hiz } = useZaman()
  const an = useZaman((d) => Math.floor(d.t / DAKIKA) * DAKIKA)
  const { oynatDuraklat, zamanaGit, hizAyarla } = useZaman.getState()
  return (
    <>
      <button
        type="button"
        onClick={oynatDuraklat}
        title={t(oynatiliyor ? 'zaman.duraklat' : 'zaman.oynat')}
        aria-label={t(oynatiliyor ? 'zaman.duraklat' : 'zaman.oynat')}
        className="grid size-[34px] place-items-center rounded-[8px] bg-guclu text-zemin hover:bg-white"
      >
        {oynatiliyor ? <IkonDuraklat boyut={15} /> : <IkonOynat boyut={15} />}
      </button>
      <KucukDugme etiket={t('olayDuzeni.geri')} onClick={() => zamanaGit(useZaman.getState().t - SAAT)}>
        <IkonIleri boyut={13} className="-scale-x-100" />
      </KucukDugme>
      <KucukDugme etiket={t('zaman.ileri')} onClick={() => zamanaGit(useZaman.getState().t + SAAT)} pasif={an >= bitis}>
        <IkonIleri boyut={13} />
      </KucukDugme>
      <label className="relative">
        <span className="sr-only">{t('zaman.hiz')}</span>
        <select
          value={Math.round(hiz / TEMEL_HIZ)}
          onChange={(e) => hizAyarla(Number(e.target.value) * TEMEL_HIZ)}
          className="h-[30px] w-[56px] appearance-none rounded-[7px] border border-cizgi bg-yuzey pl-2.5 text-[12.5px]"
        >
          {HIZLAR.map((h) => (
            <option key={h} value={h}>
              {h}×
            </option>
          ))}
        </select>
        <IkonAsagi boyut={11} className="pointer-events-none absolute top-[10px] right-2 text-soluk" />
      </label>
    </>
  )
}

function Seritler({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  const baslangic = useZaman((d) => d.baslangic)
  const bitis = useZaman((d) => d.bitis)
  const zaman = useZaman((d) => d.t)
  const an = Math.floor(zaman / DAKIKA) * DAKIKA
  const zamanaGit = useZaman((d) => d.zamanaGit)
  const odaklanIste = useHarita((d) => d.odaklanIste)
  const ref = useRef<HTMLDivElement>(null)
  const [olayRef, { gen: olayGen }] = useBoyut<HTMLDivElement>()

  const oran = (x: number) => Math.min(Math.max((x - baslangic) / Math.max(bitis - baslangic, 1), 0), 1)

  // Yarım saatte bir örnek; şeritler aynı x dizisini paylaşır.
  const s = useMemo(() => {
    const xs: number[] = []
    for (let x = baslangic; x <= bitis; x += SAAT / 2) xs.push(x)
    const hava = xs.map((x) => veri.hava(x))
    const model = xs.map(veri.yananAlanHa)
    const firms = xs.map(veri.firmsAlanHa)
    const hiz = xs.map(veri.hizMDk)
    const ruzgar = hava.map((h) => h.ruzgarKmSa)
    const sicaklik = hava.map((h) => h.sicaklik)
    const nem = hava.map((h) => h.nem)
    const yakit = hava.map((h) => h.yakitNemi)
    const gunler: number[] = []
    // İlk yerel gece yarısı (TSİ = UTC+3).
    for (let x = Math.ceil((baslangic + 3 * SAAT) / (24 * SAAT)) * 24 * SAAT - 3 * SAAT; x <= bitis; x += 24 * SAAT) gunler.push(x)
    return {
      xs,
      gunler,
      model,
      firms,
      hiz,
      ruzgar,
      sicaklik,
      nem,
      yakit,
      alanUst: guzelUst(Math.max(...model, ...firms) * 1.05),
      hizUst: kirpilmisUst(hiz),
      ruzgarUst: guzelUst(Math.max(...ruzgar) * 1.1),
      sicaklikUst: guzelUst(Math.max(...sicaklik) * 1.1),
      nemUst: guzelUst(Math.max(...nem, ...yakit) * 1.1),
    }
  }, [baslangic, bitis, veri])

  const basladi = an >= veri.tutusmaMs
  const h = veri.hava(an)
  const tire = t('hava.baslamadi')
  const alan: Serit = {
    kimlik: 'alan',
    ad: t('olayDuzeni.seritler.yananAlan'),
    yuk: 60,
    ust: s.alanUst,
    seriler: [
      {
        ys: s.model,
        renk: '#f06a45',
        dolgu: 'rgba(236,90,58,0.24)',
        deger: basladi ? `${sayi(veri.yananAlanHa(an))} ha` : tire,
      },
      {
        ys: s.firms,
        renk: '#f2b84a',
        kesik: true,
        deger: basladi ? `${sayi(veri.firmsAlanHa(an))} ha` : tire,
        etiket: t('olayDuzeni.uyduAlani'),
      },
    ],
  }
  const seritler: Serit[] = [
    alan,
    {
      kimlik: 'hiz',
      ad: t('olayDuzeni.seritler.cepheHizi'),
      yuk: 34,
      ust: s.hizUst,
      seriler: [{ ys: s.hiz, renk: '#f06a45', deger: basladi ? t('hava.mDk', { deger: sayi(veri.hizMDk(an), 1) }) : tire }],
    },
    {
      kimlik: 'ruzgar',
      ad: t('olayDuzeni.seritler.ruzgar'),
      yuk: 34,
      ust: s.ruzgarUst,
      seriler: [
        { ys: s.ruzgar, renk: '#9fc7ef', deger: `${t('hava.kmSa', { deger: Math.round(h.ruzgarKmSa) })} ${pusulaYonu(h.ruzgarYonu)}` },
      ],
    },
    {
      kimlik: 'sicaklik',
      ad: t('olayDuzeni.seritler.sicaklik'),
      yuk: 28,
      ust: s.sicaklikUst,
      seriler: [{ ys: s.sicaklik, renk: '#e8a04a', deger: t('hava.derece', { deger: Math.round(h.sicaklik) }) }],
    },
    {
      kimlik: 'nem',
      ad: t('olayDuzeni.seritler.nem'),
      yuk: 34,
      ust: s.nemUst,
      seriler: [
        { ys: s.nem, renk: '#5f9fdc', deger: yuzdeBicim(h.nem / 100) },
        { ys: s.yakit, renk: '#7cc46e', deger: yuzdeBicim(h.yakitNemi / 100), etiket: t('olayDuzeni.yakitNemi') },
      ],
    },
  ]

  const sec = (e: PointerEvent) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const o = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1)
    zamanaGit(baslangic + o * (bitis - baslangic))
  }
  // Tıklanan olay işaretinin kartı (anahtar: grubun ilk olayının zamanı). Dışarı tıklamak yalnızca
  // kartı kapatır, haritadaki işaret kalır; Esc ve × ikisini birden kaldırır.
  const [acik, setAcik] = useState<number | null>(null)
  const olaySec = useOlay((d) => d.olaySec)
  const kartRef = useRef<HTMLDivElement>(null)
  const kapat = () => {
    setAcik(null)
    olaySec(null)
  }
  useEffect(() => {
    if (acik === null) return
    const dinle = (e: Event) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') {
          setAcik(null)
          olaySec(null)
        }
      } else if (!kartRef.current?.contains(e.target as Node)) setAcik(null)
    }
    document.addEventListener('pointerdown', dinle)
    document.addEventListener('keydown', dinle)
    return () => {
      document.removeEventListener('pointerdown', dinle)
      document.removeEventListener('keydown', dinle)
    }
  }, [acik, olaySec])
  const git = (o: OnemliOlay) => {
    olaySec(o)
    zamanaGit(o.zaman)
    if (o.x !== undefined && o.z !== undefined) odaklanIste(o.x, o.z)
  }
  const imlec = oran(zaman)
  const saatSonra = Math.max(Math.round((an - veri.tutusmaMs) / SAAT), 0)
  // Zaman sırasıyla; bir öncekinden TOPLAMA_PX'ten yakın olay aynı gruba girer.
  const gruplar: OnemliOlay[][] = []
  for (const o of [...veri.olaylar].sort((a, b) => a.zaman - b.zaman)) {
    const son = gruplar.at(-1)
    const onceki = son?.at(-1)
    if (son && onceki && (oran(o.zaman) - oran(onceki.zaman)) * olayGen < TOPLAMA_PX) son.push(o)
    else gruplar.push([o])
  }

  const acikGrup = gruplar.find((g) => g[0].zaman === acik)

  return (
    <div className="relative select-none">
      {acikGrup && (
        <OlayKarti
          kartRef={kartRef}
          olaylar={acikGrup}
          oran={oran(acikGrup[0].zaman)}
          git={git}
          kapat={kapat}
        />
      )}
      {/* Olaylar şeridi: işaretler tıklanınca o ana ve yere gider. */}
      <div className="grid h-[30px] grid-cols-[212px_1fr] items-center border-b border-white/[0.12]">
        {/* Seçili an: olay işaretleriyle aynı satırda, şerit adlarının üstünde. */}
        <div className="flex items-baseline gap-2 px-3.5 whitespace-nowrap">
          <span className="text-[13px] font-semibold tabular-nums">{gunAySaat(an)}</span>
          <span className="text-[12px] text-soluk">{t('olayDuzeni.saatSayaci', { saat: saatSonra })}</span>
        </div>
        <div ref={olayRef} className="relative h-full" style={{ marginRight: SAG }}>
          {gruplar.map((g) => {
            const ilk = g[0]
            const onemli = g.some((o) => o.tur === 'tutusma')
            const metin = g.map((o) => `${t(`olaylar.turler.${o.tur}`)} · ${gunAySaat(o.zaman)}`).join('\n')
            const secili = acik === ilk.zaman
            return (
              <button
                key={`${ilk.tur}-${ilk.zaman}`}
                type="button"
                // Kartın dışına tıklama onu kapatır; işaretin kendisi kapatıp yeniden açmasın.
                onPointerDown={(e) => e.nativeEvent.stopImmediatePropagation()}
                onClick={() => {
                  if (secili) return kapat()
                  git(ilk)
                  setAcik(ilk.zaman)
                }}
                title={secili ? undefined : metin}
                aria-label={metin}
                aria-expanded={secili}
                className="group absolute top-1/2 z-20 flex h-[16px] -translate-y-1/2 items-center gap-1 pl-[4.5px]"
                style={{ left: `calc(${oran(ilk.zaman) * 100}% - 8px)` }}
              >
                <span
                  className={`size-[7px] rotate-45 rounded-[1px] transition-transform group-hover:scale-150 ${secili ? 'scale-150 ring-2 ring-metin' : ''}`}
                  style={{ background: onemli ? ONEMLI_RENK : OLAY_RENGI }}
                />
                {g.length > 1 && (
                  <span className={`text-[10.5px] leading-none font-medium ${secili ? 'text-metin' : 'text-soluk'}`}>{g.length}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {seritler.map((sr) => (
        <div
          key={sr.kimlik}
          className="grid grid-cols-[212px_1fr] items-center border-b border-white/[0.12]"
          style={{ height: sr.yuk + 10 }}
        >
          <SeritAdi ad={sr.ad} seriler={sr.seriler} />
          <div style={{ marginRight: SAG, height: sr.yuk }}>
            <SeritGrafigi seriler={sr.seriler} ust={sr.ust} />
          </div>
        </div>
      ))}

      {/* Gün ekseni */}
      <div className="grid h-[28px] grid-cols-[212px_1fr] items-center">
        <div />
        <div className="relative h-full text-[11px] whitespace-nowrap text-silik" style={{ marginRight: SAG }}>
          <span className="absolute top-[6px] left-0">{gunAySaat(baslangic)}</span>
          {s.gunler
            // Baştaki tarih yazısıyla ve sağ kenarla çakışan gün yazıları atlanır.
            .filter((x) => oran(x) * olayGen > 115 && (1 - oran(x)) * olayGen > 25)
            .map((x) => (
              <span key={x} className="absolute top-[6px] -translate-x-1/2" style={{ left: `${oran(x) * 100}%` }}>
                {gunAy(x)}
              </span>
            ))}
        </div>
      </div>

      {/* Tıkla / sürükle katmanı ve seçili an çizgisi */}
      <div
        ref={ref}
        className="absolute top-[30px] bottom-0 z-10 cursor-pointer touch-none"
        style={{ left: ETIKET, right: SAG }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          sec(e)
        }}
        onPointerMove={(e) => e.buttons === 1 && sec(e)}
        role="slider"
        tabIndex={0}
        aria-label={t('zaman.imlec')}
        aria-valuemin={baslangic}
        aria-valuemax={bitis}
        aria-valuenow={zaman}
        aria-valuetext={gunAySaat(zaman)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') zamanaGit(zaman + SAAT)
          if (e.key === 'ArrowLeft') zamanaGit(zaman - SAAT)
        }}
      >
        <div
          className="pointer-events-none absolute -top-[30px] bottom-[28px] w-[1.5px] -translate-x-1/2 bg-metin"
          style={{ left: `${imlec * 100}%` }}
        />
      </div>
    </div>
  )
}

/** Olay işaretine tıklanınca üstünde açılan kart: gruptaki her olay için başlık, saat ve kısa özet. */
function OlayKarti({
  kartRef,
  olaylar,
  oran,
  git,
  kapat,
}: {
  kartRef: RefObject<HTMLDivElement | null>
  olaylar: OnemliOlay[]
  oran: number
  git: (o: OnemliOlay) => void
  kapat: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="pointer-events-none absolute bottom-full z-40 mb-2" style={{ left: ETIKET, right: SAG }}>
      <div
        ref={kartRef}
        role="dialog"
        aria-label={t('olayDuzeni.seritler.olaylar')}
        className="pointer-events-auto absolute bottom-0 w-[260px] rounded-[10px] border border-cizgi bg-panel p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
        style={{ left: `${oran * 100}%`, transform: `translateX(-${etiketKaymasi(oran)}%)` }}
      >
        <div className="flex items-center justify-between px-2 pt-1 pb-1.5 text-[11.5px] text-soluk">
          <span>
            {olaylar.length > 1
              ? t('olayDuzeni.olayKarti.grup', {
                  sayi: olaylar.length,
                  aralik: `${gunAySaat(olaylar[0].zaman)} – ${saatBicim(olaylar.at(-1)!.zaman)}`,
                })
              : gunAySaat(olaylar[0].zaman)}
          </span>
          <button type="button" onClick={kapat} aria-label={t('olayDuzeni.olayKarti.kapat')} className="px-1 text-[14px] leading-none hover:text-metin">
            ×
          </button>
        </div>
        <ul className="max-h-[300px] overflow-y-auto">
          {olaylar.map((o) => (
            <li key={`${o.tur}-${o.zaman}`}>
              <button
                type="button"
                onClick={() => git(o)}
                title={t('olaylar.git')}
                className="flex w-full items-center gap-2.5 rounded-[7px] px-2 py-1.5 text-left text-[12.5px] leading-[16px] hover:bg-yuzey"
              >
                <span className="grid size-[22px] shrink-0 place-items-center rounded-[6px] bg-yuzey">
                  <OlayIkonu tur={o.tur} boyut={13} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate font-semibold">{t(`olaylar.turler.${o.tur}`)}</span>
                    <span className="ml-auto text-[11.5px] text-soluk tabular-nums">{saatBicim(o.zaman)}</span>
                  </span>
                  {olayOzeti(o, t) && <span className="block truncate text-[11.5px] text-soluk">{olayOzeti(o, t)}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** Tek şeridin SVG grafiği: yarı ve tam ölçekte silik kılavuz çizgileri, altta taban çizgisi. */
function SeritGrafigi({ seriler, ust }: { seriler: Seri[]; ust: number }) {
  const [ref, { gen, yuk }] = useBoyut<HTMLDivElement>()
  const yollar = useMemo(() => {
    if (!gen || !yuk) return []
    return seriler.map((sr) => {
      const n = sr.ys.length
      const px = (i: number) => (i / Math.max(n - 1, 1)) * gen
      const py = (v: number) => yuk - 1 - (Math.min(Math.max(v, 0), ust) / ust) * (yuk - 3)
      const cizgi = sr.ys.map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join('')
      return {
        ...sr,
        cizgi,
        alan: sr.dolgu ? `${cizgi}L${gen},${yuk}L0,${yuk}Z` : null,
      }
    })
  }, [seriler, ust, gen, yuk])
  const kilavuz = (oran: number) => yuk - 1 - oran * (yuk - 3)
  return (
    <div ref={ref} className="relative h-full">
      {gen > 0 && (
        <svg width={gen} height={yuk} className="absolute inset-0 overflow-visible">
          {[0.5, 1].map((o) => (
            <line key={o} x1={0} x2={gen} y1={kilavuz(o)} y2={kilavuz(o)} stroke="#1f1f1f" />
          ))}
          <line x1={0} x2={gen} y1={yuk - 0.5} y2={yuk - 0.5} stroke="#333" />
          {yollar.map((y, i) => (
            <g key={i}>
              {y.alan && <path d={y.alan} fill={y.dolgu} />}
              <path
                d={y.cizgi}
                fill="none"
                stroke={y.renk}
                strokeWidth={y.kesik ? 1.3 : 1.7}
                strokeDasharray={y.kesik ? '4 3' : undefined}
              />
            </g>
          ))}
        </svg>
      )}
    </div>
  )
}

/** Şeridin etiket hücresi: her seri bir satır; çizgi örneği ve adı solda, seçili andaki değeri sağda. */
function SeritAdi({ ad, seriler }: { ad: string; seriler: Seri[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 px-3.5 text-[12px] leading-[15px] whitespace-nowrap">
      {seriler.map((sr) => (
        <div key={sr.renk} className="flex items-center gap-2">
          <svg width="10" height="4" aria-hidden className="shrink-0">
            <line x1="0" x2="10" y1="2" y2="2" stroke={sr.renk} strokeWidth="2" strokeDasharray={sr.kesik ? '3 2' : undefined} />
          </svg>
          <span className="truncate text-soluk">{sr.etiket ?? ad}</span>
          <span className="ml-auto font-medium tabular-nums">{sr.deger}</span>
        </div>
      ))}
    </div>
  )
}

function KucukDugme({
  etiket,
  pasif = false,
  onClick,
  children,
}: {
  etiket: string
  pasif?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={etiket}
      aria-label={etiket}
      disabled={pasif}
      onClick={onClick}
      className={`grid size-[30px] place-items-center rounded-[7px] border border-cizgi bg-yuzey hover:bg-yuzey-acik ${pasif ? 'opacity-40' : ''}`}
    >
      {children}
    </button>
  )
}

/** İmleç etiketinin yatay kayması (%): ortada 50, uçlarda 0 / 100. */
const etiketKaymasi = (o: number) => (o < 0.5 ? Math.min(o / 0.05, 1) * 50 : 100 - Math.min((1 - o) / 0.05, 1) * 50)
