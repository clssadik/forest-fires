import type { ReactNode } from 'react'

/**
 * Sol çekmecenin ortak parçaları. Tek boşluk ölçeği (sağ sütunla aynı): bölümler 20 px yan,
 * 16 px dikey boşlukla ve aralarında çizgiyle; başlıktan içeriğe 12 px; kartların içi 12 px,
 * kartlar arası 8 px.
 */
export function Bolum({ baslik, alt, sag, children }: { baslik?: ReactNode; alt?: ReactNode; sag?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-cizgi px-5 py-4 first:border-t-0">
      {baslik && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[13.5px] leading-[18px] font-semibold">{baslik}</h3>
            {alt && <p className="mt-0.5 text-[12px] leading-4 text-ikincil">{alt}</p>}
          </div>
          {sag}
        </header>
      )}
      {children}
    </section>
  )
}

/** Açma/kapama anahtarının görünüşü; tıklamayı onu saran satır (`role="switch"`) alır. */
export function AnahtarGorseli({ acik }: { acik: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative h-[18px] w-[30px] shrink-0 rounded-full transition-colors ${
        acik ? 'bg-guclu' : 'bg-yuzey-acik shadow-[inset_0_0_0_1px_var(--color-eksen)]'
      }`}
    >
      <span className={`absolute top-[3px] left-[3px] size-3 rounded-full transition-transform ${acik ? 'translate-x-3 bg-zemin' : 'bg-white'}`} />
    </span>
  )
}
