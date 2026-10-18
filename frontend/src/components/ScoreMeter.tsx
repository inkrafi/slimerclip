import { scoreTier } from '@/lib/clip-meta'

/**
 * Skor viral sebagai meter level audio: 10 batang, makin tinggi skor makin "panas".
 * Toska untuk level aman, lila untuk kuat, pink panas untuk momen paling panas.
 */
function barColor(index: number) {
  if (index >= 8) return 'var(--color-meter-hot)'
  if (index >= 6) return 'var(--color-meter-mid)'
  return 'var(--color-meter-low)'
}

export default function ScoreMeter({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' }) {
  const lit = Math.round(Math.max(0, Math.min(100, score)) / 10)
  const barH = size === 'sm' ? 'h-3' : 'h-4'

  return (
    <div className="flex items-center gap-2.5" role="img" aria-label={`Skor viral ${score} dari 100, ${scoreTier(score).toLowerCase()}`}>
      <div className="flex items-end gap-[2px]" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className={`w-[3px] rounded-[1px] ${barH}`}
            style={{ background: i < lit ? barColor(i) : 'var(--color-rule)' }}
          />
        ))}
      </div>
      <span className="timecode text-ink font-bold text-base leading-none" aria-hidden>{score}</span>
    </div>
  )
}
