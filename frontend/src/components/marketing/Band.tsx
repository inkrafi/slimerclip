type Tone = 'indigo' | 'noir' | 'violet' | 'plum' | 'teal' | 'ink' | 'magenta'

interface Props {
  tone: Tone
  id?: string
  labelledBy?: string
  className?: string
  /** Isi lebar penuh, tanpa pembatas lebar halaman */
  bleed?: boolean
  children: React.ReactNode
}

/** Satu section halaman jasa: latar lebar penuh dengan warna lampunya sendiri (lihat .band-* di globals.css). */
export default function Band({ tone, id, labelledBy, className = '', bleed, children }: Props) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={`band band-${tone} scroll-mt-14 ${className}`}>
      {bleed ? children : <div className="relative mx-auto max-w-6xl px-4 sm:px-6">{children}</div>}
    </section>
  )
}
