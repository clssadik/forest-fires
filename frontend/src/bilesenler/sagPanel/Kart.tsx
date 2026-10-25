import type { ReactNode } from 'react'

/** Sağ paneldeki başlıklı kart. */
export function Kart({
  baslik,
  ek,
  sag,
  children,
}: {
  baslik: ReactNode
  ek?: ReactNode
  sag?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-[5px] bg-panel shadow-[0_0_0_1px_rgba(120,110,90,0.12)]">
      <header className="flex h-[34px] items-center gap-2 bg-panel-baslik px-3">
        <h2 className="text-[14px] font-semibold">{baslik}</h2>
        {ek && <span className="text-[11.5px] text-soluk">{ek}</span>}
        <span className="ml-auto">{sag}</span>
      </header>
      {children}
    </section>
  )
}
