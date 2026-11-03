/** Pita teks berjalan pemisah section. Dekoratif: isinya sudah ada di section lain. */
export default function Ticker({ items }: { items: string[] }) {
  const row = [...items, ...items]
  return (
    <div className="ticker overflow-hidden py-4" aria-hidden>
      <div className="ticker-track flex w-max items-center">
        {[...row, ...row].map((item, i) => (
          <span key={i} className="flex items-center">
            <span className="type-heading whitespace-nowrap text-lg text-ink-muted sm:text-xl">{item}</span>
            <span className="mx-6 size-1.5 rounded-full bg-label-iris/70" />
          </span>
        ))}
      </div>
    </div>
  )
}
