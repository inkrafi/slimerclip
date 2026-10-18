import { Me } from '@/lib/types'

/** Foto profil Google, atau huruf pertama nama jika tidak ada. */
export default function Avatar({ me, size = 'size-12' }: { me: Me; size?: string }) {
  if (me.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element -- foto profil Google dari domain luar
    return <img src={me.avatar_url} alt="" referrerPolicy="no-referrer" className={`${size} shrink-0 rounded-full border border-rule`} />
  }
  return (
    <span className={`${size} shrink-0 rounded-full bg-raised border border-rule grid place-items-center font-semibold text-ink`} aria-hidden>
      {(me.name || '?').slice(0, 1).toUpperCase()}
    </span>
  )
}
