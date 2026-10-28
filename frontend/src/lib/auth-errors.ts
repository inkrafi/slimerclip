import type { Locale } from '@/lib/i18n'

const MESSAGES: Record<string, Record<Locale, string>> = {
  invalid_credentials: { id: 'Email atau kata sandi salah.', en: 'Wrong email or password.' },
  email_not_confirmed: {
    id: 'Email belum dikonfirmasi. Buka link konfirmasi yang dikirim ke emailmu.',
    en: "Your email isn't confirmed yet. Open the confirmation link we sent you.",
  },
  email_exists: { id: 'Email ini sudah terdaftar. Silakan masuk.', en: 'This email is already registered. Please sign in.' },
  weak_password: {
    id: 'Kata sandi terlalu lemah. Pakai minimal 8 karakter, campur huruf dan angka.',
    en: 'Password is too weak. Use at least 8 characters with letters and numbers.',
  },
  same_password: { id: 'Kata sandi baru harus berbeda dari yang lama.', en: 'Your new password must be different from the old one.' },
  email_address_invalid: { id: 'Alamat email tidak valid.', en: 'Invalid email address.' },
  rate_limit: { id: 'Terlalu banyak percobaan. Tunggu beberapa menit, lalu coba lagi.', en: 'Too many attempts. Wait a few minutes and try again.' },
  signup_disabled: {
    id: 'Pendaftaran dengan email sedang ditutup. Silakan pakai Google.',
    en: 'Email sign-up is currently closed. Please use Google.',
  },
  session_not_found: { id: 'Sesi sudah berakhir. Minta link baru, lalu coba lagi.', en: 'Your session has expired. Request a new link and try again.' },
  unknown: { id: 'Terjadi kesalahan. Coba lagi.', en: 'Something went wrong. Please try again.' },
}

const ALIASES: Record<string, string> = {
  user_already_exists: 'email_exists',
  validation_failed: 'email_address_invalid',
  over_email_send_rate_limit: 'rate_limit',
  over_request_rate_limit: 'rate_limit',
  email_provider_disabled: 'signup_disabled',
  refresh_token_not_found: 'session_not_found',
}

/** Pesan error Supabase Auth dalam bahasa pengguna. */
export function authErrorMessage(error: unknown, locale: Locale = 'id'): string {
  const code = (error as { code?: string } | null)?.code ?? ''
  const key = ALIASES[code] ?? code
  if (MESSAGES[key]) return MESSAGES[key][locale]
  return error instanceof Error && error.message ? error.message : MESSAGES.unknown[locale]
}

export const MIN_PASSWORD = 8
