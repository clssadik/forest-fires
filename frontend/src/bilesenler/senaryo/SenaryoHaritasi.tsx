import calisanAdresi from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import {
  type GeoJSONSource,
  type ImageSource,
  Map as MaplibreHaritasi,
  type MapMouseEvent,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { sayi } from '../../bicim'
import { hucreIndeksi } from '../../dogrulama/konum'
import { tutusmaMs, useSenaryo } from '../../durum/senaryo'
import { useZaman } from '../../durum/zaman'
import { altlikAdresi } from '../../senaryo/api'
import { BANTLAR, BANT_RENKLERI, boya, hucreZamanlari } from '../../senaryo/boyama'

setWorkerUrl(calisanAdresi)

const DAKIKA = 60_000
/** 1 × 1 saydam PNG (bkz. DogrulamaHaritasi: boş görüntü kaynağı yüklemeyi kilitliyor). */
const BOS_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII='
/** Henüz sonuç yokken görüntü kaynaklarının yer tutucu köşeleri (görünmez). */
const BOS_KOSELER: [[number, number], [number, number], [number, number], [number, number]] = [
  [0, 0.001],
  [0.001, 0.001],
  [0.001, 0],
  [0, 0],
]
/** Açılış görünümü: Türkiye. */
const ACILIS = { center: [34.5, 38.9] as [number, number], zoom: 5.4 }

interface Imlec {
  x: number
  y: number
  zamanlar: (number | null)[]
}

/** Senaryo haritası: dünya altlığı (OSM), tıklanınca tutuşma noktası; olasılık bantlarıyla yayılım. */
export function SenaryoHaritasi() {
  const { t } = useTranslation()
  const kap = useRef<HTMLDivElement>(null)
  const [harita, setHarita] = useState<MaplibreHaritasi | null>(null)
  const [imlec, setImlec] = useState<Imlec | null>(null)
  const ozet = useSenaryo((d) => d.ozet)
  const nokta = useSenaryo((d) => d.nokta)
  const altlik = useSenaryo((d) => d.altlik)
  const calisiyor = useSenaryo((d) => d.durum === 'calisiyor')

  useEffect(() => {
    if (!kap.current) return
    const m = new MaplibreHaritasi({
      container: kap.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            maxzoom: 19,
            attribution: '© OpenStreetMap',
          },
          altlik: { type: 'image', url: BOS_PNG, coordinates: BOS_KOSELER },
          yangin: { type: 'image', url: BOS_PNG, coordinates: BOS_KOSELER },
          nokta: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
        },
        layers: [
          { id: 'arka', type: 'background', paint: { 'background-color': '#d1cab8' } },
          { id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-saturation': -0.35 } },
          {
            id: 'altlik',
            type: 'raster',
            source: 'altlik',
            layout: { visibility: 'none' },
            paint: { 'raster-fade-duration': 0, 'raster-opacity': 0.8 },
          },
          {
            id: 'yangin',
            type: 'raster',
            source: 'yangin',
            paint: { 'raster-fade-duration': 0, 'raster-resampling': 'nearest' },
          },
          {
            id: 'nokta',
            type: 'circle',
            source: 'nokta',
            paint: {
              'circle-radius': 6.5,
              'circle-color': '#d4472a',
              'circle-stroke-color': '#fffaf0',
              'circle-stroke-width': 2.5,
            },
          },
        ],
      },
      ...ACILIS,
      attributionControl: { compact: true, customAttribution: t('senaryo.harita.kaynaklar') },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    })
    m.touchZoomRotate.disableRotation()
    m.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    m.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-right')
    m.getCanvas().style.cursor = 'crosshair'
    m.on('click', (e) => void useSenaryo.getState().calistir(e.lngLat.lat, e.lngLat.lng))
    m.on('load', () => setHarita(m))
    return () => {
      setHarita(null)
      m.remove()
    }
  }, [t])

  // Seçilen nokta.
  useEffect(() => {
    if (!harita) return
    ;(harita.getSource('nokta') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: nokta
        ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [nokta.boylam, nokta.enlem] } }]
        : [],
    })
  }, [harita, nokta])

  // Yeni sonuç: görüntü kaynaklarını sonucun köşelerine taşı, hesap alanına yakınlaş.
  useEffect(() => {
    if (!harita || !ozet) return
    const koseler = ozet.harita.koseler as typeof BOS_KOSELER
    ;(harita.getSource('yangin') as ImageSource).setCoordinates(koseler)
    ;(harita.getSource('altlik') as ImageSource).updateImage({ url: altlikAdresi(ozet), coordinates: koseler })
    const [b, g, d, k] = ozet.harita.sinirlar
    // Hesap alanı 40 km; yangının çoğu merkezde kalır, bu yüzden alanın ortasına biraz daha yakın.
    const pay = 0.2
    harita.fitBounds(
      [
        [b + (d - b) * pay, g + (k - g) * pay],
        [d - (d - b) * pay, k - (k - g) * pay],
      ],
      { padding: 24, duration: 900 },
    )
  }, [harita, ozet])

  useEffect(() => {
    harita?.setLayoutProperty('altlik', 'visibility', altlik ? 'visible' : 'none')
  }, [harita, altlik])

  // Zaman ya da veri değişince yangın katmanı bir sonraki karede yeniden boyanır.
  useEffect(() => {
    if (!harita) return
    const kaynak = harita.getSource('yangin') as ImageSource
    let resim: ImageData | null = null
    let istek = 0
    const ciz = () => {
      istek = 0
      const d = useSenaryo.getState()
      const r = d.rasterlar
      if (!r || !d.ozet) return
      if (!resim || resim.width !== r.genislik || resim.height !== r.yukseklik) resim = new ImageData(r.genislik, r.yukseklik)
      const tDk = (useZaman.getState().t - tutusmaMs(d.ozet)) / DAKIKA
      d.anlikAyarla(boya(r, tDk, new Uint32Array(resim.data.buffer)))
      kaynak.updateImage({ image: resim })
    }
    const planla = () => {
      if (!istek) istek = requestAnimationFrame(ciz)
    }
    planla()
    const zamanBagi = useZaman.subscribe((s, o) => s.t !== o.t && planla())
    const veriBagi = useSenaryo.subscribe((s, o) => s.rasterlar !== o.rasterlar && planla())
    return () => {
      zamanBagi()
      veriBagi()
      cancelAnimationFrame(istek)
    }
  }, [harita])

  // İmlecin altındaki hücrenin üç olasılığa ulaşma anı.
  useEffect(() => {
    if (!harita) return
    const hareket = (e: MapMouseEvent) => {
      const { rasterlar: r, ozet: o } = useSenaryo.getState()
      const i = r && o && hucreIndeksi(o.harita.koseler, r.genislik, r.yukseklik, e.lngLat.lng, e.lngLat.lat)
      if (!r || i === null || i === undefined) return setImlec(null)
      const zamanlar = hucreZamanlari(r, i)
      setImlec(zamanlar[0] === null ? null : { x: e.point.x, y: e.point.y, zamanlar })
    }
    const ayril = () => setImlec(null)
    harita.on('mousemove', hareket)
    harita.on('mouseout', ayril)
    return () => {
      harita.off('mousemove', hareket)
      harita.off('mouseout', ayril)
    }
  }, [harita])

  return (
    <div className="relative min-h-0 flex-1">
      <div className="absolute inset-0">
        <div ref={kap} className="size-full" />
      </div>
      <Lejant />
      {(calisiyor || !harita) && (
        <div className="absolute top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-panel/95 px-3.5 py-1.5 text-[12.5px] shadow-[0_0_0_1px_rgba(120,110,90,0.18),0_2px_6px_rgba(0,0,0,0.08)]">
          <span className="size-3.5 animate-spin rounded-full border-2 border-koyu/25 border-t-koyu" />
          {t(calisiyor ? 'senaryo.harita.hesaplaniyor' : 'senaryo.harita.yukleniyor')}
        </div>
      )}
      {!nokta && harita && (
        <div className="pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-koyu/90 px-4 py-1.5 text-[13px] text-white shadow">
          {t('senaryo.harita.ipucu')}
        </div>
      )}
      {imlec && (
        <div
          className="pointer-events-none absolute z-10 rounded-[5px] bg-[#2f2c27]/92 px-2.5 py-1.5 text-[12px] leading-[18px] whitespace-nowrap text-white shadow"
          style={{ left: imlec.x + 14, top: imlec.y + 14 }}
        >
          {BANTLAR.map((b, k) => (
            <div key={b} className="flex items-center gap-1.5">
              <span className="size-[9px] rounded-[2px]" style={{ background: BANT_RENKLERI[b] }} />
              <span className="text-white/60">{t(`senaryo.bantlar.${b}Kisa`)}</span>
              {imlec.zamanlar[k] === null ? '—' : `+${sayi(imlec.zamanlar[k]! / 60, 1)} ${t('dogrulama.birim.sa')}`}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Lejant() {
  const { t } = useTranslation()
  const ozet = useSenaryo((d) => d.ozet)
  if (!ozet) return null
  return (
    <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1.5 rounded-[5px] bg-panel/95 px-3 py-2 text-[12px] shadow-[0_0_0_1px_rgba(120,110,90,0.18),0_2px_6px_rgba(0,0,0,0.08)]">
      <div className="font-medium">{t('senaryo.lejant.baslik')}</div>
      {[...BANTLAR].reverse().map((b) => (
        <div key={b} className="flex items-center gap-2">
          <span className="size-[11px] shrink-0 rounded-[2px]" style={{ background: BANT_RENKLERI[b] }} />
          {t(`senaryo.bantlar.${b}`)}
        </div>
      ))}
      <div className="flex items-center gap-2">
        <span className="size-[10px] rounded-full border-2 border-[#fffaf0] bg-ates shadow-[0_0_0_1px_rgba(0,0,0,0.2)]" />
        {t('dogrulama.lejant.tutusma')}
      </div>
    </div>
  )
}
