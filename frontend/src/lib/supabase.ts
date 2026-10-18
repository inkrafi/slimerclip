import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

/**
 * Client Supabase untuk login Google. Null jika env belum diisi: aplikasi berjalan dalam
 * mode lokal (tanpa login, backend menganggap semua request dari admin lokal).
 * Data aplikasi tidak dibaca langsung dari Supabase; semuanya lewat backend.
 */
export const supabase: SupabaseClient | null =
  url && publishableKey
    ? createClient(url, publishableKey, {
        auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null

export const AUTH_ENABLED = supabase !== null

/** Access token sesi saat ini (diperbarui otomatis oleh supabase-js jika hampir kedaluwarsa). */
export async function accessToken(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

/** Tujuan setelah login: hanya path internal, agar tidak bisa dipakai untuk redirect ke situs lain. */
export const safeNext = (next: string | null | undefined) =>
  next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
