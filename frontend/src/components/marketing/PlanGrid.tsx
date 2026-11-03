import { Check } from 'lucide-react'
import ContactButtons from '@/components/marketing/ContactButtons'
import Reveal from '@/components/marketing/Reveal'
import type { Plan } from '@/content/pricing'
import type { Locale } from '@/lib/i18n'

interface Props {
  locale: Locale
  plans: Plan[]
  /** Label kecil pada paket yang disarankan */
  pickLabel: string
  /** Teks tombol tiap paket */
  ctaLabel: (plan: Plan) => string
  /** Pesan pembuka chat/email tiap paket */
  message: (plan: Plan) => string
  subject: string
  /** Kelas kolom grid */
  columns: string
}

export default function PlanGrid({ locale, plans, pickLabel, ctaLabel, message, subject, columns }: Props) {
  const anyFrom = plans.some(plan => plan.from)
  return (
    <ul className={`mt-12 grid gap-5 ${columns}`}>
      {plans.map((plan, i) => (
        <li key={plan.name} className="flex">
          <Reveal delay={i * 70} className="flex w-full">
            <div className={`plan-card relative flex w-full flex-col rounded-xl border p-6 ${plan.featured ? 'plan-featured border-signal' : 'border-rule'}`}>
              <h3 className="type-heading text-xl text-ink">{plan.name}</h3>
              <p className="mt-1 min-h-5 text-sm font-semibold text-signal">{plan.featured ? pickLabel : ''}</p>
              <p className="mt-2 text-ink">
                {anyFrom && <span className="block min-h-5 text-sm text-ink-muted">{plan.from ?? ''}</span>}
                <span className="type-display block text-[2.1rem]">{plan.price}</span>
                <span className="block min-h-5 text-sm text-ink-muted">{plan.unit ?? ''}</span>
              </p>
              <ul className="mb-7 mt-5 space-y-2.5 border-t border-rule pt-5 text-sm text-ink-muted">
                {plan.items.map(item => (
                  <li key={item} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-label-iris" aria-hidden />{item}</li>
                ))}
              </ul>
              <div className="mt-auto [&_a]:w-full [&_a]:px-3">
                <ContactButtons locale={locale} message={message(plan)} subject={subject} primaryLabel={ctaLabel(plan)} primaryOnly quiet={!plan.featured} />
              </div>
            </div>
          </Reveal>
        </li>
      ))}
    </ul>
  )
}
