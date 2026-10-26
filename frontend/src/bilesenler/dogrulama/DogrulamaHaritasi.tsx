import {
  Map as MaplibreHaritasi,
  NavigationControl,
  ScaleControl,
  type ExpressionSpecification,
  type ImageSource,
  type MapMouseEvent,
  setWorkerUrl,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// MapLibre çalışanını (worker) kendi yanındaki dosyadan yükler; Vite paketlemesinde bu yol
// kayboluyor. Vite çalışanı bağımlılıklarıyla tek dosyaya paketleyip adresini verir.
import calisanAdresi from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { gunAySaat, sayi } from '../../bicim'
import { altlikAdresi, firmsAdresi, gercekAlanAdresi } from '../../dogrulama/api'
import { FIRMS_DURAKLARI, YOK, boya } from '../../dogrulama/boyama'
import { hucreIndeksi } from '../../dogrulama/konum'
import { bitisMs, tutusmaMs, useDogrulama, type DogrulamaKatmani } from '../../durum/dogrulama'
import { useZaman } from '../../durum/zaman'
import { Lejant } from './Lejant'

setWorkerUrl(calisanAdresi)

const DAKIKA = 60_000
/** 1 × 1 saydam PNG. Görüntüsüz başlayan görüntü kaynağı haritanın yüklenmesini kilitliyor
 *  (MapLibre 6.16), bu yüzden yangın katmanı bununla başlar ve sonra boyanır. */
const BOS_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII='

/** Katman → MapLibre katman kimlikleri (model katmanı boyamada gizlenir). */
const HARITA_KATMANLARI: Partial<Record<DogrulamaKatmani, string[]>> = {
  osm: ['osm'],
  altlik: ['altlik'],
  gercek: ['gercek-cizgi'],
  firms: ['firms'],
}

// FIRMS katmanı imleç zamanını MapLibre'nin global durumundan (`saat`) okur. Süzgeç yerine
// saydamlık kullanılır: süzgeç değişince GeoJSON her karede yeniden işlenirdi.
const SAAT_DURUMU: ExpressionSpecification = ['global-state', 'saat']
const firmsRengi: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['-', SAAT_DURUMU, ['get', 'saat']],
  ...FIRMS_DURAKLARI.flat(),
]
const firmsGorunur: ExpressionSpecification = ['case', ['<=', ['get', 'saat'], SAAT_DURUMU], 1, 0]

interface Imlec {
  x: number
  y: number
  model: number | null
  firms: number | null
  gercek: boolean
}

/** Gerçek veriyle 2B doğrulama haritası (MapLibre): altlık, model yayılımı, gerçek alan, FIRMS. */
export function DogrulamaHaritasi() {
  const { t } = useTranslation()
  const kap = useRef<HTMLDivElement>(null)
  const bilgi = useDogrulama((d) => d.bilgi)
  const katmanlar = useDogrulama((d) => d.katmanlar)
  const veriYukleniyor = useDogrulama((d) => d.yukleme === 'yukleniyor' || d.simulasyon === 'calisiyor')
  const [harita, setHarita] = useState<MaplibreHaritasi | null>(null)
  const [imlec, setImlec] = useState<Imlec | null>(null)
  // Harita, altlık ve vektörler gelene kadar `load` olayını vermez.
  const yukleniyor = veriYukleniyor || !harita

  // Harita bir kez, bölge bilgisi gelince kurulur.
  useEffect(() => {
    if (!bilgi || !kap.current) return
    const { ad } = useDogrulama.getState()
    const koseler = bilgi.harita.koseler as [[number, number], [number, number], [number, number], [number, number]]
    const { enlem, boylam } = bilgi.tutusma_konumu
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
          altlik: { type: 'image', url: altlikAdresi(ad), coordinates: koseler },
          yangin: { type: 'image', url: BOS_PNG, coordinates: koseler },
          gercek: { type: 'geojson', data: gercekAlanAdresi(ad) },
          firms: { type: 'geojson', data: firmsAdresi(ad) },
          tutusma: { type: 'geojson', data: { type: 'Point', coordinates: [boylam, enlem] } },
        },
        layers: [
          { id: 'arka', type: 'background', paint: { 'background-color': '#d1cab8' } },
          { id: 'altlik', type: 'raster', source: 'altlik', paint: { 'raster-fade-duration': 0 } },
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
            layout: { visibility: 'none' },
            paint: { 'raster-saturation': -0.5, 'raster-opacity': 0.85 },
          },
          {
            id: 'yangin',
            type: 'raster',
            source: 'yangin',
            paint: { 'raster-fade-duration': 0, 'raster-resampling': 'nearest' },
          },
          {
            id: 'gercek-cizgi',
            type: 'line',
            source: 'gercek',
            paint: {
              'line-color': '#1f1d19',
              'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1, 13, 2.2],
              'line-opacity': 0.85,
            },
          },
          {
            id: 'firms',
            type: 'circle',
            source: 'firms',
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 1.8, 13, 4.5],
              'circle-color': firmsRengi,
              'circle-opacity': firmsGorunur,
              'circle-stroke-color': '#1f1d19',
              'circle-stroke-width': 0.6,
              'circle-stroke-opacity': firmsGorunur,
            },
          },
          {
            id: 'tutusma',
            type: 'circle',
            source: 'tutusma',
            paint: {
              'circle-radius': 6,
              'circle-color': '#d4472a',
              'circle-stroke-color': '#fffaf0',
              'circle-stroke-width': 2.5,
            },
          },
        ],
      },
      globalState: { saat: -1e9 },
      bounds: bilgi.harita.sinirlar,
      fitBoundsOptions: { padding: 24 },
      attributionControl: { compact: true, customAttribution: t('dogrulama.harita.kaynaklar') },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    })
    m.touchZoomRotate.disableRotation()
    m.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    m.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-right')
    m.on('load', () => setHarita(m))
    return () => {
      setHarita(null)
      m.remove()
    }
  }, [bilgi, t])

  // Zaman, veri ya da renk kipi değişince yangın katmanı bir sonraki karede yeniden boyanır.
  useEffect(() => {
    if (!harita) return
    const kaynak = harita.getSource('yangin') as ImageSource
    let resim: ImageData | null = null
    let istek = 0
    const ciz = () => {
      istek = 0
      const d = useDogrulama.getState()
      const r = d.rasterlar
      if (!r || !d.bilgi) return
      if (!resim) resim = new ImageData(r.genislik, r.yukseklik)
      const bas = tutusmaMs(d.bilgi)
      const tDk = (useZaman.getState().t - bas) / DAKIKA
      const bitisDk = (bitisMs(d.bilgi) - bas) / DAKIKA
      const cikti = new Uint32Array(resim.data.buffer)
      d.anlikAyarla(boya(r, tDk, bitisDk, d.renkKipi, cikti, d.katmanlar.model))
      kaynak.updateImage({ image: resim })
      harita.setGlobalStateProperty('saat', tDk / 60)
    }
    const planla = () => {
      if (!istek) istek = requestAnimationFrame(ciz)
    }
    planla()
    const zamanBagi = useZaman.subscribe((s, o) => s.t !== o.t && planla())
    const veriBagi = useDogrulama.subscribe(
      (s, o) =>
        (s.rasterlar !== o.rasterlar || s.renkKipi !== o.renkKipi || s.katmanlar.model !== o.katmanlar.model) &&
        planla(),
    )
    return () => {
      zamanBagi()
      veriBagi()
      cancelAnimationFrame(istek)
    }
  }, [harita])

  useEffect(() => {
    if (!harita) return
    for (const [k, kimlikler] of Object.entries(HARITA_KATMANLARI))
      for (const kimlik of kimlikler)
        harita.setLayoutProperty(kimlik, 'visibility', katmanlar[k as DogrulamaKatmani] ? 'visible' : 'none')
  }, [harita, katmanlar])

  // İmlecin altındaki hücre: model ve FIRMS varışı, gerçekte yandı mı.
  useEffect(() => {
    if (!harita || !bilgi) return
    const hareket = (e: MapMouseEvent) => {
      const r = useDogrulama.getState().rasterlar
      const i = r && hucreIndeksi(bilgi.harita.koseler, r.genislik, r.yukseklik, e.lngLat.lng, e.lngLat.lat)
      if (!r || i === null) return setImlec(null)
      const zaman = (v: number | undefined) => (v === undefined || v === YOK ? null : v)
      setImlec({
        x: e.point.x,
        y: e.point.y,
        model: zaman(r.model?.[i]),
        firms: zaman(r.firms[i]),
        gercek: r.gercek[i] === 1,
      })
    }
    const ayril = () => setImlec(null)
    harita.on('mousemove', hareket)
    harita.on('mouseout', ayril)
    return () => {
      harita.off('mousemove', hareket)
      harita.off('mouseout', ayril)
    }
  }, [harita, bilgi])

  const bas = bilgi ? tutusmaMs(bilgi) : 0
  const varis = (dk: number | null) =>
    dk === null ? '—' : `${gunAySaat(bas + dk * DAKIKA)} (+${sayi(dk / 60, 1)} ${t('dogrulama.birim.sa')})`

  return (
    <div className="relative min-h-0 flex-1">
      {/* MapLibre kabı kendi CSS'iyle position: relative yapar; boyutu sarmalayıcıdan alır. */}
      <div className="absolute inset-0">
        <div ref={kap} className="size-full" />
      </div>
      <Lejant />
      {yukleniyor && (
        <div className="absolute top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-panel/95 px-3.5 py-1.5 text-[12.5px] shadow-[0_0_0_1px_rgba(120,110,90,0.18),0_2px_6px_rgba(0,0,0,0.08)]">
          <span className="size-3.5 animate-spin rounded-full border-2 border-koyu/25 border-t-koyu" />
          {t('dogrulama.harita.yukleniyor')}
        </div>
      )}
      {imlec && (
        <div
          className="pointer-events-none absolute z-10 rounded-[5px] bg-[#2f2c27]/92 px-2.5 py-1.5 text-[12px] leading-[18px] whitespace-nowrap text-white shadow"
          style={{ left: imlec.x + 14, top: imlec.y + 14 }}
        >
          <div>
            <span className="text-white/60">{t('dogrulama.imlec.model')}</span> {varis(imlec.model)}
          </div>
          <div>
            <span className="text-white/60">{t('dogrulama.imlec.firms')}</span> {varis(imlec.firms)}
          </div>
          <div>
            <span className="text-white/60">{t('dogrulama.imlec.gercek')}</span>{' '}
            {t(imlec.gercek ? 'dogrulama.imlec.yandi' : 'dogrulama.imlec.yanmadi')}
          </div>
        </div>
      )}
    </div>
  )
}
