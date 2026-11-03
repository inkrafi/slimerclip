import Reveal from '@/components/marketing/Reveal'

/** Garis gelombang yang menggambar dirinya saat masuk layar, sebagai sambungan antar section. */
export default function WaveDivider() {
  return (
    <Reveal className="wave-divider mx-auto max-w-6xl px-4 sm:px-6">
      <svg viewBox="0 0 1200 48" preserveAspectRatio="none" className="h-12 w-full" aria-hidden>
        <path pathLength={1} fill="none" stroke="rgb(211 179 255 / 0.4)" strokeWidth="1.5" vectorEffect="non-scaling-stroke"
          d="M0 24 C60 24 80 10 120 24 S190 40 240 24 S330 6 380 24 S460 38 520 24 S600 24 640 24 L680 4 L700 44 L720 10 L740 38 L760 24 C820 24 860 12 900 24 S980 38 1040 24 S1140 14 1200 24" />
      </svg>
    </Reveal>
  )
}
