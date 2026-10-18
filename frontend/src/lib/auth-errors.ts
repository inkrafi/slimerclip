/** Pesan error Supabase Auth dalam bahasa pengguna. */
export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code
  switch (code) {
    case 'invalid_credentials':
      return 'Email atau kata sandi salah.'
    case 'email_not_confirmed':
      return 'Email belum dikonfirmasi. Buka link konfirmasi yang dikirim ke emailmu.'
    case 'user_already_exists':
    case 'email_exists':
      return 'Email ini sudah terdaftar. Silakan masuk.'
    case 'weak_password':
      return 'Kata sandi terlalu lemah. Pakai minimal 8 karakter, campur huruf dan angka.'
    case 'same_password':
      return 'Kata sandi baru harus berbeda dari yang lama.'
    case 'email_address_invalid':
    case 'validation_failed':
      return 'Alamat email tidak valid.'
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Terlalu banyak percobaan. Tunggu beberapa menit, lalu coba lagi.'
    case 'signup_disabled':
    case 'email_provider_disabled':
      return 'Pendaftaran dengan email sedang ditutup. Silakan pakai Google.'
    case 'session_not_found':
    case 'refresh_token_not_found':
      return 'Sesi sudah berakhir. Minta link baru, lalu coba lagi.'
  }
  return error instanceof Error && error.message ? error.message : 'Terjadi kesalahan. Coba lagi.'
}

export const MIN_PASSWORD = 8
