import { Plus } from 'lucide-react'
import Band from '@/components/marketing/Band'
import Reveal from '@/components/marketing/Reveal'

export default function Faq({ title, items }: { title: string; items: { q: string; a: string }[] }) {
  return (
    <Band tone="ink" labelledBy="faq-title">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Reveal><h2 id="faq-title" className="type-display text-ink text-[clamp(2rem,4vw,3.2rem)]">{title}</h2></Reveal>
        <Reveal delay={100}>
          <div className="divide-y divide-rule border-y border-rule">
            {items.map(item => (
              <details key={item.q} className="faq-item group">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold text-ink [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <Plus className="faq-icon size-5 shrink-0 text-signal group-open:rotate-45" aria-hidden />
                </summary>
                <p className="max-w-[65ch] pb-5 leading-relaxed text-ink-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </Band>
  )
}
