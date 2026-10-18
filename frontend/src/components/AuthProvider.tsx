'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AUTH_EXPIRED_EVENT, getMe } from '@/lib/api'
import { AUTH_ENABLED, safeNext, supabase } from '@/lib/supabase'
import { Me } from '@/lib/types'

interface AuthState {
  /** false = mode lokal tanpa login (semua fitur admin) */
  enabled: boolean
  /** Status sesi sudah diketahui (sudah/tidak login) */
  ready: boolean
  /** Boleh memakai aplikasi: sudah login, atau mode lokal */
  signedIn: boolean
  session: Session | null
  /** Profil + kuota dari backend; null selama dimuat */
  me: Me | null
  refreshMe: () => void
  signInWithGoogle: (next?: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionReady, setSessionReady] = useState(!AUTH_ENABLED)
  const [me, setMe] = useState<Me | null>(null)

  useEffect(() => {
    if (!supabase) return
    const applySession = (s: Session | null) => {
      setSession(s)
      setSessionReady(true)
    }
    supabase.auth.getSession().then(({ data }) => applySession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => applySession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const signedIn = !AUTH_ENABLED || session !== null
  const userId = session?.user.id ?? null

  const refreshMe = useCallback(() => {
    getMe().then(setMe).catch(() => {})
  }, [])

  // Profil dimuat ulang setiap kali pengguna berganti (login/logout)
  useEffect(() => {
    if (!sessionReady || !signedIn) return
    let cancelled = false
    getMe().then(m => { if (!cancelled) setMe(m) }).catch(() => {})
    return () => { cancelled = true }
  }, [sessionReady, signedIn, userId])

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setMe(null)
  }, [])

  // Backend menolak token (dicabut/kedaluwarsa) → keluar, halaman yang butuh login mengarahkan ke /masuk
  useEffect(() => {
    if (!AUTH_ENABLED) return
    const onExpired = () => { signOut() }
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
  }, [signOut])

  const signInWithGoogle = useCallback(async (next?: string) => {
    if (!supabase) return
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
    if (error) throw error
  }, [])

  const value = useMemo<AuthState>(() => ({
    enabled: AUTH_ENABLED,
    ready: sessionReady,
    signedIn,
    session,
    me: signedIn ? me : null,
    refreshMe,
    signInWithGoogle,
    signOut,
  }), [sessionReady, signedIn, session, me, refreshMe, signInWithGoogle, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>')
  return ctx
}
