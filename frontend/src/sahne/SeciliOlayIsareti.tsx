import { useTranslation } from 'react-i18next'
import { saat } from '../bicim'
import { useOlay } from '../durum/olay'
import type { OlayVerisi } from '../olay/veri'
import { Etiket } from './Etiket'

const YUKSELTI = 0.12

/**
 * Zaman panelinde seçilen olayın haritadaki yeri: yanıp sönen halka ve olayın adıyla saati.
 * Etiket sürekli bağlı kalır, seçim yokken gizlenir (bkz. Etiket).
 */
export function SeciliOlayIsareti({ veri, kabartma }: { veri: OlayVerisi; kabartma: number }) {
  const { t } = useTranslation()
  const olay = useOlay((d) => d.seciliOlay)
  const x = olay?.x ?? 0
  const z = olay?.z ?? 0
  const gorunur = olay?.x !== undefined && olay.z !== undefined
  return (
    <Etiket position={[x, veri.araziY(x, z) * kabartma + YUKSELTI, z]} zIndexRange={[25, 0]}>
      <div className={`pointer-events-none relative ${gorunur ? '' : 'invisible'}`}>
        <span className="absolute -top-[18px] -left-[18px] size-[36px] animate-ping rounded-full border-2 border-white" />
        <span className="absolute -top-[9px] -left-[9px] size-[18px] rounded-full border-2 border-white bg-white/25 shadow-[0_0_0_2px_rgba(0,0,0,0.5)]" />
        {olay && (
          <div className="absolute top-[-13px] left-[18px] rounded-[5px] bg-white px-2 py-1 text-[12.5px] leading-[16px] font-semibold whitespace-nowrap text-zemin shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
            {t(`olaylar.turler.${olay.tur}`)} <span className="font-normal opacity-70">· {saat(olay.zaman)}</span>
          </div>
        )}
      </div>
    </Etiket>
  )
}
