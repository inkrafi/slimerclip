import { CONTACT } from '@/content/service'

export type LegalSection = { title: string; body: string[] }

interface Props {
  title: string
  updated: string
  intro: string
  sections: LegalSection[]
  contactLabel: string
}

/** Halaman legal: satu kolom teks yang nyaman dibaca. */
export default function LegalPage({ title, updated, intro, sections, contactLabel }: Props) {
  return (
    <article className="mx-auto max-w-3xl px-4 pb-24 pt-16 sm:px-6 md:pt-24">
      <h1 className="type-display text-ink text-[clamp(2.4rem,5vw,3.8rem)]">{title}</h1>
      <p className="mt-3 text-sm text-ink-muted">{updated}</p>
      <p className="mt-8 text-lg leading-relaxed text-ink-muted">{intro}</p>
      {sections.map(section => (
        <section key={section.title} className="mt-10">
          <h2 className="type-heading text-2xl text-ink">{section.title}</h2>
          {section.body.map(paragraph => (
            <p key={paragraph} className="mt-3 leading-relaxed text-ink-muted">{paragraph}</p>
          ))}
        </section>
      ))}
      {CONTACT.email && (
        <p className="mt-10 border-t border-rule pt-6 text-ink-muted">
          {contactLabel} <a href={`mailto:${CONTACT.email}`} className="text-ink underline underline-offset-4">{CONTACT.email}</a>
        </p>
      )}
    </article>
  )
}
