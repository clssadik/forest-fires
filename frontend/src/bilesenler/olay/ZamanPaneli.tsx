import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { gunAy, gunAySaat, saat as saatBicim, sayi, yuzdeBicim } from '../../bicim'
import { useHarita } from '../../durum/harita'
import { useZaman } from '../../durum/zaman'
import { useBoyut } from '../../kancalar/useBoyut'
import { guzelUst, kirpilmisUst } from '../../olay/olcek'
import { pusulaYonu, type OlayVerisi, type OnemliOlay } from '../../olay/veri'
import { olayAciklamasi } from '../altSerit/OnemliOlaylar'
import { OlayIkonu } from '../OlayIkonu'
import {
  IkonAlev,
  IkonAsagi,
  IkonBayrak,
  IkonDamla,
  IkonDuraklat,
  IkonIleri,
  IkonOynat,
  IkonRuzgar,
  IkonSimsek,
  IkonTermometre,
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
/** Eksende imleç etiketinin iki yanında gün yazısı gösterilmeyen genişlik (px). */
const ETIKET_BOSLUK = 70

interface Seri {
  ys: number[]
  renk: string
  dolgu?: string
  kesik?: boolean
}

interface Serit {
  kimlik: string
  ikon: ReactNode
  ad: string
  deger: string
  lejant?: ReactNode
  yuk: number
  ust: number
  seriler: Seri[]
}

/**
 * Olay ekranının alt paneli: oynatma denetimleri ve aynı zaman ekseninde alt alta şeritler.
 * Şeritler her zaman açık: olaylar, yanan alan, cephe hızı, rüzgâr, sıcaklık, nem ve yakıt nemi.
 * Şeritlerin üstüne tıklamak ya da sürüklemek zamanı o ana götürür; beyaz çizgi seçili an, tarihi
 * eksende. Birbirine yakın olaylar tek işarette toplanır. Şeritler
 * baştan sona aynı parlaklıkta çizilir (karşılaştırma için); geçmiş/gelecek ayrımını imleç yapar.
 */
export function ZamanPaneli({ veri }: { veri: OlayVerisi | null }) {
  return (
    <section className="shrink-0 border-t border-cizgi bg-olaylar">
      <div className="flex h-[50px] items-center gap-2 border-b border-cizgi px-3.5 whitespace-nowrap">
        <Denetimler veri={veri} />
      </div>
      {veri && <Seritler veri={veri} />}
    </section>
  )
}

function Denetimler({ veri }: { veri: OlayVerisi | null }) {
  const { t } = useTranslation()
  const { bitis, oynatiliyor, hiz } = useZaman()
  const an = useZaman((d) => Math.floor(d.t / DAKIKA) * DAKIKA)
  const { oynatDuraklat, zamanaGit, hizAyarla } = useZaman.getState()
  const saatSonra = veri ? Math.max(Math.round((an - veri.tutusmaMs) / SAAT), 0) : 0
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
      <span className="ml-2 text-[15px] font-semibold">{gunAySaat(an)}</span>
      {veri && <span className="text-[12px] text-soluk">· {t('olayDuzeni.saatSayaci', { saat: saatSonra })}</span>}
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
    ikon: <IkonAlev boyut={14} />,
    ad: t('olayDuzeni.seritler.yananAlan'),
    deger: basladi ? `${sayi(veri.yananAlanHa(an))} ha` : tire,
    lejant: (
      <>
        <Lejant renk="#f06a45">{t('olayDuzeni.lejant.model')}</Lejant>
        <Lejant renk="#f2b84a" kesik>
          {t('olayDuzeni.lejant.firms')}
        </Lejant>
      </>
    ),
    yuk: 60,
    ust: s.alanUst,
    seriler: [
      { ys: s.model, renk: '#f06a45', dolgu: 'rgba(236,90,58,0.24)' },
      { ys: s.firms, renk: '#f2b84a', kesik: true },
    ],
  }
  const seritler: Serit[] = [
    alan,
    {
      kimlik: 'hiz',
      ikon: <IkonSimsek boyut={14} />,
      ad: t('olayDuzeni.seritler.cepheHizi'),
      deger: basladi ? t('hava.mDk', { deger: sayi(veri.hizMDk(an), 1) }) : tire,
      yuk: 34,
      ust: s.hizUst,
      seriler: [{ ys: s.hiz, renk: '#f06a45' }],
    },
    {
      kimlik: 'ruzgar',
      ikon: <IkonRuzgar boyut={14} />,
      ad: t('olayDuzeni.seritler.ruzgar'),
      deger: `${t('hava.kmSa', { deger: Math.round(h.ruzgarKmSa) })} ${pusulaYonu(h.ruzgarYonu)}`,
      yuk: 34,
      ust: s.ruzgarUst,
      seriler: [{ ys: s.ruzgar, renk: '#9fc7ef' }],
    },
    {
      kimlik: 'sicaklik',
      ikon: <IkonTermometre boyut={14} />,
      ad: t('olayDuzeni.seritler.sicaklik'),
      deger: t('hava.derece', { deger: Math.round(h.sicaklik) }),
      yuk: 28,
      ust: s.sicaklikUst,
      seriler: [{ ys: s.sicaklik, renk: '#e8a04a' }],
    },
    {
      kimlik: 'nem',
      ikon: <IkonDamla boyut={14} />,
      ad: t('olayDuzeni.seritler.nem'),
      deger: `${yuzdeBicim(h.nem / 100)} · ${yuzdeBicim(h.yakitNemi / 100)}`,
      yuk: 28,
      ust: s.nemUst,
      seriler: [
        { ys: s.nem, renk: '#5f9fdc' },
        { ys: s.yakit, renk: '#7cc46e' },
      ],
    },
  ]

  const sec = (e: PointerEvent) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const o = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1)
    zamanaGit(baslangic + o * (bitis - baslangic))
  }
  // Tıklanan olay işaretinin kartı (anahtar: grubun ilk olayının zamanı).
  const [acik, setAcik] = useState<number | null>(null)
  const kartRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (acik === null) return
    const kapat = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !kartRef.current?.contains(e.target as Node)) setAcik(null)
    }
    document.addEventListener('pointerdown', kapat)
    document.addEventListener('keydown', kapat)
    return () => {
      document.removeEventListener('pointerdown', kapat)
      document.removeEventListener('keydown', kapat)
    }
  }, [acik])
  const git = (o: OnemliOlay) => {
    zamanaGit(o.zaman)
    if (o.x !== undefined && o.z !== undefined) odaklanIste(o.x, o.z)
  }
  const imlec = oran(zaman)
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
          tutusmaMs={veri.tutusmaMs}
          git={git}
          kapat={() => setAcik(null)}
        />
      )}
      {/* Olaylar şeridi: işaretler tıklanınca o ana ve yere gider. */}
      <div className="grid h-[30px] grid-cols-[212px_1fr] items-center border-b border-white/[0.05]">
        <SeritAdi ikon={<IkonBayrak boyut={14} />} ad={t('olayDuzeni.seritler.olaylar')} deger={String(veri.olaylar.length)} />
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
                  git(ilk)
                  setAcik(secili ? null : ilk.zaman)
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
          className="grid grid-cols-[212px_1fr] items-center border-b border-white/[0.05]"
          style={{ height: sr.yuk + 10 }}
        >
          <SeritAdi ikon={sr.ikon} ad={sr.ad} deger={sr.deger} lejant={sr.lejant} />
          <div style={{ marginRight: SAG, height: sr.yuk }}>
            <SeritGrafigi seriler={sr.seriler} ust={sr.ust} />
          </div>
        </div>
      ))}

      {/* Gün ekseni */}
      <div className="relative h-[22px] text-[11px] whitespace-nowrap text-silik" style={{ marginLeft: ETIKET, marginRight: SAG }}>
        {/* İmlecin tarih etiketi eksende durur; ona yakın gün yazıları gizlenir. */}
        {imlec * olayGen > ETIKET_BOSLUK + 50 && <span className="absolute top-[3px] left-0">{gunAySaat(baslangic)}</span>}
        {s.gunler
          .filter((x) => oran(x) > 0.06 && oran(x) < 0.97 && Math.abs(oran(x) - imlec) * olayGen > ETIKET_BOSLUK)
          .map((x) => (
            <span key={x} className="absolute top-[3px] -translate-x-1/2" style={{ left: `${oran(x) * 100}%` }}>
              {gunAy(x)}
            </span>
          ))}
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
          className="pointer-events-none absolute -top-[30px] bottom-0 w-[1.5px] -translate-x-1/2 bg-metin"
          style={{ left: `${imlec * 100}%` }}
        >
          <span
            className="absolute bottom-[2px] left-1/2 rounded-[5px] bg-metin px-[7px] py-[2px] text-[11.5px] font-semibold whitespace-nowrap text-zemin"
            style={{ transform: `translateX(-${etiketKaymasi(imlec)}%)` }}
          >
            {gunAySaat(an)}
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Olay işaretine tıklanınca üstünde açılan kart: gruptaki her olay ne olduğunu anlatan bir başlık,
 * kaynağı (kayıt, uydu ya da model), zamanı ve sayılarıyla bir açıklama cümlesiyle.
 */
function OlayKarti({
  kartRef,
  olaylar,
  oran,
  tutusmaMs,
  git,
  kapat,
}: {
  kartRef: RefObject<HTMLDivElement | null>
  olaylar: OnemliOlay[]
  oran: number
  tutusmaMs: number
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
        className="pointer-events-auto absolute bottom-0 w-[320px] rounded-[10px] border border-cizgi bg-panel p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
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
                className="flex w-full gap-2.5 rounded-[7px] px-2 py-2 text-left text-[12.5px] leading-[16px] hover:bg-yuzey"
              >
                <span className="mt-[1px] grid size-[22px] shrink-0 place-items-center rounded-[6px] bg-yuzey">
                  <OlayIkonu tur={o.tur} boyut={13} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="font-semibold">{t(`olaylar.turler.${o.tur}`)}</span>
                    <span className="rounded-[4px] bg-yuzey px-1.5 text-[10.5px] leading-[16px] text-soluk">{t(`olaylar.kaynak.${o.tur}`)}</span>
                    <span className="ml-auto text-[11.5px] whitespace-nowrap text-soluk">
                      {saatBicim(o.zaman)} · {t('olaylar.saat', { saat: sayi(Math.max(o.zaman - tutusmaMs, 0) / SAAT, 1) })}
                    </span>
                  </span>
                  <span className="mt-1 block text-[12px] leading-[17px] text-metin/80">{olayAciklamasi(o, t)}</span>
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

function SeritAdi({ ikon, ad, deger, lejant }: { ikon: ReactNode; ad: string; deger: string; lejant?: ReactNode }) {
  return (
    <div className="min-w-0 px-3.5 text-[12px] whitespace-nowrap">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-soluk">{ikon}</span>
        <span className="truncate text-soluk">{ad}</span>
        <span className="ml-auto font-semibold">{deger}</span>
      </div>
      {lejant && <div className="mt-1.5 flex items-center gap-3 pl-[22px] text-[11px] text-silik">{lejant}</div>}
    </div>
  )
}

function Lejant({ renk, kesik = false, children }: { renk: string; kesik?: boolean; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="14" height="4" aria-hidden>
        <line x1="0" x2="14" y1="2" y2="2" stroke={renk} strokeWidth="2" strokeDasharray={kesik ? '3 2' : undefined} />
      </svg>
      {children}
    </span>
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
