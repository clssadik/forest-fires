import { Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Vector3 } from 'three'
import { gunAySaat } from '../bicim'
import { useZaman } from '../durum/zaman'
import type { OlayVerisi } from '../olay/veri'
import { Etiket } from './Etiket'
import { etiketlerCakisir, sonGecilenSaat } from './etiketYerlesimi'

/**
 * Ana yayılım ekseni (sarı çizgi; tutuşmadan, model alanı gerçek alana eşitlendiğinde en
 * uzak yanmış noktaya), tutuşma işareti ve eksen üzerindeki izokron zaman etiketleri
 * (docs/02 §4.4). Hepsi global zamana göre görünür/gizlenir.
 */

const YUKSELTI = 0.12
const SAAT = 3_600_000
/** Etiketlenen izokronlar (tutuşmadan sonra saat). */
const IZOKRON_SAATLERI = [6, 12, 24, 48, 96]
const A = new Vector3()
const B = new Vector3()

export function YayilimIsaretleri({ veri, kabartma }: { veri: OlayVerisi; kabartma: number }) {
  const { t } = useTranslation()
  const uzunluk = veri.bilgi.eksen?.uzunluk_km ?? 0
  // Çizgiyi her karede değil, cephe ~150 m ilerledikçe yeniden kur.
  const cephe = useZaman((d) => Math.round(veri.eksendeCepheKm(d.t) / 0.15) * 0.15)
  const zaman = useZaman((d) => d.t)

  const { gecmis, gelecek } = useMemo(() => {
    const noktalar = (km0: number, km1: number) => {
      const adet = Math.max(Math.ceil((km1 - km0) / 0.25), 1)
      return Array.from({ length: adet + 1 }, (_, i) => {
        const p = veri.eksenNoktasi(km0 + ((km1 - km0) * i) / adet)
        return [p.x, veri.araziY(p.x, p.z) * kabartma + YUKSELTI, p.z] as [number, number, number]
      })
    }
    return {
      gecmis: cephe > 0 ? noktalar(0, cephe) : null,
      gelecek: cephe < uzunluk - 0.2 ? noktalar(cephe, uzunluk) : null,
    }
  }, [cephe, kabartma, veri, uzunluk])
  const izokronlar = useMemo(
    () =>
      IZOKRON_SAATLERI.filter((s) => s < veri.bitisSaat).flatMap((saat) => {
        const p = veri.eksenIzokronu(saat)
        return p ? [{ saat, p }] : []
      }),
    [veri],
  )
  // Yalnızca cephenin geçtiği son izokronun etiketi yazılır; işaretler yerinde kalır.
  const sonSaat = sonGecilenSaat(izokronlar.map((k) => k.saat), (zaman - veri.tutusmaMs) / SAAT)
  const sonIzokron = izokronlar.find((k) => k.saat === sonSaat)
  const tutusma = veri.bilgi.tutusma
  const basladi = zaman >= veri.tutusmaMs

  // Kamera eğilince eksen kısalır: son izokron etiketi ekranda tutuşmanınkine binerse yazısı gizlenir.
  const [cakisma, setCakisma] = useState(false)
  const sonCakisma = useRef(false)
  useFrame(({ camera, size }) => {
    if (!sonIzokron) return
    const y = (x: number, z: number) => veri.araziY(x, z) * kabartma + YUKSELTI
    A.set(tutusma.x, y(tutusma.x, tutusma.z), tutusma.z).project(camera)
    B.set(sonIzokron.p.x, y(sonIzokron.p.x, sonIzokron.p.z), sonIzokron.p.z).project(camera)
    const c = etiketlerCakisir(((B.x - A.x) / 2) * size.width, ((A.y - B.y) / 2) * size.height)
    if (c !== sonCakisma.current) {
      sonCakisma.current = c
      setCakisma(c)
    }
  })

  return (
    <group>
      {gelecek && (
        <Line points={gelecek} color="#f2b84a" lineWidth={2} dashed dashSize={0.35} gapSize={0.3} transparent opacity={0.75} />
      )}
      {gecmis && <Line points={gecmis} color="#f4b23c" lineWidth={2.6} />}

      {/* Hepsi sürekli bağlı kalır, yalnızca görünürlük değişir (drei Html'in yeniden bağlanma yarışından kaçınmak için). */}
      {izokronlar.map(({ saat, p }) => {
        const an = veri.tutusmaMs + saat * SAAT
        return (
          <Etiket key={saat} position={[p.x, veri.araziY(p.x, p.z) * kabartma + YUKSELTI, p.z]} zIndexRange={[19, 0]}>
            <div className={`pointer-events-none relative ${an <= zaman ? '' : 'invisible'}`}>
              <span className="absolute -top-[7px] -left-[7px] grid size-[14px] place-items-center rounded-full border-2 border-[#f6a43a] bg-[#fff4df]">
                <span className="size-[4px] rounded-full bg-[#f08a2a]" />
              </span>
              {saat === sonSaat && !cakisma && (
                <div className="absolute top-[-11px] left-[14px] rounded-[4px] bg-black/75 ring-1 ring-white/10 px-1.5 py-[2px] text-[12.5px] whitespace-nowrap text-white">
                  {t('harita.izokron', { saat })}, {gunAySaat(an)}
                </div>
              )}
            </div>
          </Etiket>
        )
      })}
      <Etiket
        key="tutusma"
        position={[tutusma.x, veri.araziY(tutusma.x, tutusma.z) * kabartma + YUKSELTI, tutusma.z]}
        zIndexRange={[20, 0]}
      >
        <div className={`pointer-events-none relative ${basladi ? '' : 'invisible'}`}>
          <span className="absolute -top-[7px] -left-[7px] size-[14px] rounded-full border-2 border-white bg-ates shadow-[0_0_14px_6px_rgba(255,170,60,0.75)]" />
          <div className="absolute top-[-14px] left-[14px] rounded-[4px] bg-black/75 ring-1 ring-white/10 px-2 py-1 text-[14px] leading-[18px] whitespace-nowrap text-white">
            {t('harita.tutusma')}
            <br />
            {gunAySaat(veri.tutusmaMs)}
          </div>
        </div>
      </Etiket>
    </group>
  )
}
