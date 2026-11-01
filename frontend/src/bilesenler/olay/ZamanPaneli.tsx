import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { gunAySaat, kisaSayi, sayi } from '../../bicim'
import { useOlay } from '../../durum/olay'
import { useZaman } from '../../durum/zaman'
import { useBoyut } from '../../kancalar/useBoyut'
import { guzelUst, kirpilmisUst } from '../../olay/olcek'
import { pusulaYonu, type OlayVerisi, type OnemliOlay } from '../../olay/veri'

const SAAT = 3_600_000
const DAKIKA = 60_000
/** Şerit adlarının sütunu ve grafiklerin sağ boşluğu (px). */
const ETIKET = 300
const SAG = 20
/**
 * Şerit satırının yüksekliği (px): gösterge düzeninde seriler yan yana durduğu için her şerit tek satır
 * (küçük ad + büyük değer, üstte ve altta eşit boşluk).
 */
const SERIT_YUKSEKLIGI = 56
/** Oynat düğmesinin satırı (px); yalnızca etiket sütununda durur, yanındaki boşluğu yanan alan grafiği kullanır. */
const OYNAT_SATIRI = 44
/** İlk şerit (yanan alan) oynat düğmesinin satırını da kaplar. */
const satirYuksekligi = (ilk: boolean) => SERIT_YUKSEKLIGI + (ilk ? OYNAT_SATIRI : 0)
/** Grafik, satırın üstünden ve altından 5'er px içeride çizilir. */
const grafikYuksekligi = (ilk = false) => satirYuksekligi(ilk) - 10

/** Yanan alan grafiğindeki olay noktalarının renkleri: uydu gözlemi FIRMS çizgisinde, model olayı model eğrisinde. */
const OLAY_RENGI: Record<OnemliOlay['tur'], string> = {
  tutusma: '#ec5a3a',
  uyduGecisi: '#5f9fdc',
  hizliBuyume: '#f2b84a',
  sirtaUlasma: '#f2b84a',
}

interface Seri {
  ys: number[]
  renk: string
  dolgu?: string
  kesik?: boolean
  /** Seçili andaki değer (kısaltılmış sayı ya da tire) ve birimi; etiket sütununda büyük ince yazılır. */
  deger: string
  birim?: string
  /** Etiket sütunundaki adı; yoksa şeridin adı. */
  etiket?: string
}

interface Serit {
  kimlik: string
  ad: string
  ust: number
  seriler: Seri[]
}

/**
 * Olay ekranının alt paneli: en üstte simülasyonu başlatan düğme, altında aynı zaman ekseninde şeritler
 * (seçili an haritanın sağ üstünde).
 * Şeritler her zaman açık: yanan alan, cephe hızı, rüzgâr, sıcaklık, nem ve yakıt nemi. Olaylar
 * yanan alan grafiğinin içinde noktalardır: uydu gözlemi FIRMS çizgisinde, model olayı model
 * eğrisinde, tutuşma tabanda. Şeritlerin üstüne tıklamak ya da sürüklemek zamanı o ana götürür;
 * beyaz çizgi seçili an; bir saat geri/ileri için sol/sağ ok tuşları. Şeritler
 * baştan sona aynı parlaklıkta çizilir (karşılaştırma için); geçmiş/gelecek ayrımını imleç yapar.
 */
export function ZamanPaneli({ veri }: { veri: OlayVerisi | null }) {
  return (
    <section className="shrink-0 border-t border-cizgi bg-olaylar">
      {veri && <Seritler veri={veri} />}
    </section>
  )
}

/** Onay yazısının ("Hazır", "Durduruldu") görünme süresi ve yazılar arası solma (ms). */
const ONAY_MS = 1000
const SOLMA_MS = 200

/**
 * Simülasyonu başlat/durdur: simgesiz, ince ve tümü büyük harf yazı (Türkçe büyütme için html lang="tr"),
 * sütunun ortasında. Oynatma başlayınca 1 sn yeşil "Hazır", durunca 1 sn kırmızı "Durduruldu" görünür;
 * onay solar ve yerini "Simülasyonu durdur" ya da "Simülasyonu başlat"a bırakır.
 */
function OynatDugmesi() {
  const { t } = useTranslation()
  const oynatiliyor = useZaman((d) => d.oynatiliyor)
  const oynatDuraklat = useZaman((d) => d.oynatDuraklat)
  const [evre, setEvre] = useState<'onay' | 'soluyor' | 'bos'>('bos')
  // Oynatma durumu değişince onay aynı çizimde başlar (araya eski yazı girmez); açılışta onay yok.
  const [onceki, setOnceki] = useState(oynatiliyor)
  if (onceki !== oynatiliyor) {
    setOnceki(oynatiliyor)
    setEvre('onay')
  }

  useEffect(() => {
    if (evre === 'bos') return
    const zamanlayici = window.setTimeout(() => setEvre(evre === 'onay' ? 'soluyor' : 'bos'), evre === 'onay' ? ONAY_MS : SOLMA_MS)
    return () => window.clearTimeout(zamanlayici)
  }, [evre, oynatiliyor])

  const [anahtar, renk] =
    evre === 'bos'
      ? [oynatiliyor ? 'zaman.simulasyonuDurdur' : 'zaman.simulasyonuBaslat', 'text-metin hover:text-white']
      : oynatiliyor
        ? ['zaman.hazir', 'text-yesil']
        : ['zaman.durduruldu', 'text-[#ff3b30]']
  return (
    <button
      type="button"
      onClick={oynatDuraklat}
      className={`w-full text-center text-[18px] leading-6 font-light tracking-[0.06em] whitespace-nowrap uppercase transition-opacity duration-200 ${renk} ${
        evre === 'soluyor' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {t(anahtar)}
    </button>
  )
}

function Seritler({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  const baslangic = useZaman((d) => d.baslangic)
  const bitis = useZaman((d) => d.bitis)
  const zaman = useZaman((d) => d.t)
  const an = Math.floor(zaman / DAKIKA) * DAKIKA
  const zamanaGit = useZaman((d) => d.zamanaGit)
  const ref = useRef<HTMLDivElement>(null)

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
    return {
      xs,
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
    ust: s.alanUst,
    seriler: [
      {
        ys: s.model,
        renk: '#f06a45',
        dolgu: 'rgba(236,90,58,0.24)',
        deger: basladi ? kisaSayi(veri.yananAlanHa(an)) : tire,
        birim: basladi ? t('olayDuzeni.birim.ha') : undefined,
      },
      {
        ys: s.firms,
        renk: '#f2b84a',
        kesik: true,
        deger: basladi ? kisaSayi(veri.firmsAlanHa(an)) : tire,
        birim: basladi ? t('olayDuzeni.birim.ha') : undefined,
        etiket: t('olayDuzeni.uyduAlani'),
      },
    ],
  }
  const seritler: Serit[] = [
    alan,
    {
      kimlik: 'hiz',
      ad: t('olayDuzeni.seritler.cepheHizi'),
      ust: s.hizUst,
      seriler: [
        {
          ys: s.hiz,
          renk: '#f06a45',
          deger: basladi ? sayi(veri.hizMDk(an), 1) : tire,
          birim: basladi ? t('olayDuzeni.birim.mDk') : undefined,
        },
      ],
    },
    {
      kimlik: 'ruzgar',
      ad: t('olayDuzeni.seritler.ruzgar'),
      ust: s.ruzgarUst,
      seriler: [
        {
          ys: s.ruzgar,
          renk: '#9fc7ef',
          deger: kisaSayi(Math.round(h.ruzgarKmSa)),
          birim: `${t('olayDuzeni.birim.kmSa')} · ${pusulaYonu(h.ruzgarYonu)}`,
        },
      ],
    },
    {
      kimlik: 'sicaklik',
      ad: t('olayDuzeni.seritler.sicaklik'),
      ust: s.sicaklikUst,
      seriler: [{ ys: s.sicaklik, renk: '#e8a04a', deger: kisaSayi(Math.round(h.sicaklik)), birim: '°C' }],
    },
    {
      kimlik: 'nem',
      ad: t('olayDuzeni.seritler.nem'),
      ust: s.nemUst,
      seriler: [
        { ys: s.nem, renk: '#5f9fdc', deger: kisaSayi(Math.round(h.nem)), birim: '%' },
        { ys: s.yakit, renk: '#7cc46e', deger: kisaSayi(Math.round(h.yakitNemi)), birim: '%', etiket: t('olayDuzeni.yakitNemi') },
      ],
    },
  ]

  const sec = (e: PointerEvent) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const o = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1)
    zamanaGit(baslangic + o * (bitis - baslangic))
  }
  // Tıklanan olay seçilir: haritada yeri işaretlenir.
  const seciliOlay = useOlay((d) => d.seciliOlay)
  const olayaGit = useOlay((d) => d.olayaGit)
  const imlec = oran(zaman)
  // Olay noktasının grafikteki yüksekliği (px, üstten); SeritGrafigi ile aynı ölçek.
  const olayY = (o: OnemliOlay) => {
    const v = o.tur === 'tutusma' ? 0 : o.tur === 'uyduGecisi' ? veri.firmsAlanHa(o.zaman) : veri.yananAlanHa(o.zaman)
    const yuk = grafikYuksekligi(true)
    return yuk - 1 - (Math.min(Math.max(v, 0), alan.ust) / alan.ust) * (yuk - 3)
  }

  return (
    <div className="relative select-none">
      {seritler.map((sr, i) => (
        <div
          key={sr.kimlik}
          className="grid items-center border-b border-white/[0.12]"
          style={{ gridTemplateColumns: `${ETIKET}px 1fr`, height: satirYuksekligi(i === 0) }}
        >
          {i === 0 ? (
            <div className="flex h-full flex-col">
              <div className="flex shrink-0 items-center border-b border-white/[0.12] px-5" style={{ height: OYNAT_SATIRI }}>
                <OynatDugmesi />
              </div>
              <div className="flex flex-1 flex-col justify-center">
                <SeritAdi ad={sr.ad} seriler={sr.seriler} />
              </div>
            </div>
          ) : (
            <SeritAdi ad={sr.ad} seriler={sr.seriler} />
          )}
          <div className="relative" style={{ marginRight: SAG, height: grafikYuksekligi(i === 0) }}>
            <SeritGrafigi seriler={sr.seriler} ust={sr.ust} />
            {sr.kimlik === 'alan' &&
              veri.olaylar.map((o) => {
                const metin = `${t(`olaylar.turler.${o.tur}`)} · ${gunAySaat(o.zaman)}`
                const secili = seciliOlay === o
                return (
                  <button
                    key={`${o.tur}-${o.zaman}`}
                    type="button"
                    onClick={() => olayaGit(o)}
                    title={metin}
                    aria-label={metin}
                    aria-pressed={secili}
                    className="group absolute z-20 grid size-[14px] -translate-1/2 place-items-center"
                    style={{ left: `${oran(o.zaman) * 100}%`, top: olayY(o) }}
                  >
                    <span
                      className={`size-[7px] rounded-full ring-[1.5px] ring-olaylar transition-transform group-hover:scale-150 ${secili ? 'scale-150 !ring-metin' : ''}`}
                      style={{ background: OLAY_RENGI[o.tur] }}
                    />
                  </button>
                )
              })}
          </div>
        </div>
      ))}

      {/* Tıkla / sürükle katmanı ve seçili an çizgisi */}
      <div
        ref={ref}
        className="absolute top-0 bottom-0 z-10 cursor-pointer touch-none"
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
          className="pointer-events-none absolute top-0 bottom-0 w-[1.5px] -translate-x-1/2 bg-metin"
          style={{ left: `${imlec * 100}%` }}
        />
      </div>
    </div>
  )
}

/** Tek şeridin SVG grafiği; kılavuz çizgisi yok, şeritleri yalnızca aralarındaki çizgi ayırır. */
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
  return (
    <div ref={ref} className="relative h-full">
      {gen > 0 && (
        <svg width={gen} height={yuk} className="absolute inset-0 overflow-visible">
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
/**
 * Gösterge düzeni: seriler yan yana; her birinde aralıklı küçük büyük harfli ad, altında büyük ince
 * değer ve küçük birim (Türkçe büyütme için html lang="tr"). İkinci seri sağa yaslanır: sol ve sağ
 * kenar boşluğu eşit kalır. Yazı kutuları leading-none: harflerin üstündeki ve altındaki boşluk eşit
 * olur (ölçüldü: ~11 / ~12 px).
 */
function SeritAdi({ ad, seriler }: { ad: string; seriler: Seri[] }) {
  return (
    <div className="grid min-w-0 grid-flow-col auto-cols-fr gap-3 px-5 whitespace-nowrap">
      {seriler.map((sr, i) => (
        <div key={sr.renk} className={`min-w-0 ${i > 0 ? 'text-right' : ''}`}>
          <div className="truncate text-[10px] leading-none tracking-[0.12em] text-[#8a8a8a] uppercase">{sr.etiket ?? ad}</div>
          <div className="mt-1.5 text-[20px] leading-none font-light text-white tabular-nums">
            {sr.deger}
            {sr.birim && <span className="ml-1 text-[10px] tracking-[0.08em] text-[#8a8a8a] uppercase">{sr.birim}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

