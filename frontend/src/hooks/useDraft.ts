import { useEffect, useState } from 'react'

/**
 * State form yang otomatis tersimpan di localStorage (key per form), agar isi yang sedang diketik tidak hilang saat
 * halaman dimuat ulang atau ditinggal. clear() setelah berhasil dikirim. Gagal akses storage = state biasa.
 */
export function useDraft<T>(key: string, initial: T): [T, (next: T) => void, () => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial
    try {
      const raw = localStorage.getItem(key)
      return raw ? { ...initial, ...JSON.parse(raw) } as T : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch { /* storage penuh / diblokir: cukup di memori */ }
  }, [key, value])

  const clear = () => {
    try { localStorage.removeItem(key) } catch { /* abaikan */ }
  }
  return [value, setValue, clear]
}
