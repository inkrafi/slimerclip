import Band from '@/components/marketing/Band'
import Reveal from '@/components/marketing/Reveal'

interface Props {
  title: string
  steps: { title: string; body: string }[]
  columns?: string
}

export default function Steps({ title, steps, columns = 'md:grid-cols-3' }: Props) {
  return (
    <Band tone="teal" labelledBy="steps-title">
      <Reveal><h2 id="steps-title" className="type-display text-ink text-[clamp(2rem,4.5vw,3.6rem)]">{title}</h2></Reveal>
      <ol className={`mt-14 grid gap-10 ${columns}`}>
        {steps.map((step, i) => (
          <li key={step.title}>
            <Reveal delay={i * 110}>
              <div className="step-line" aria-hidden><span className="fill-bar" style={{ transitionDelay: `${i * 110 + 200}ms` }} /></div>
              <p className="timecode type-display mt-6 text-5xl text-label-iris">0{i + 1}</p>
              <h3 className="mt-4 type-heading text-xl text-ink">{step.title}</h3>
              <p className="mt-2 leading-relaxed text-ink-muted">{step.body}</p>
            </Reveal>
          </li>
        ))}
      </ol>
    </Band>
  )
}
