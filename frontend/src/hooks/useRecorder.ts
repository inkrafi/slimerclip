'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** Format rekaman yang didukung browser (Chrome/Firefox: webm/ogg opus, Safari: mp4) */
function pickMime(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
  return types.find(t => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) ?? ''
}

export function recordingFilename(blob: Blob): string {
  return `rekaman.${blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'}`
}

/**
 * Rekam suara dari mikrofon. stop() mengembalikan rekamannya; mikrofon dilepas setelah selesai
 * (atau saat komponen dilepas) agar indikator mikrofon browser mati.
 */
export function useRecorder() {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const release = useCallback(() => {
    recorder.current?.stream.getTracks().forEach(t => t.stop())
    recorder.current = null
    if (timer.current) clearInterval(timer.current)
    timer.current = null
    setRecording(false)
  }, [])

  useEffect(() => release, [release])

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    const mime = pickMime()
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    chunks.current = []
    rec.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data) }
    rec.start(250)
    recorder.current = rec
    setSeconds(0)
    setRecording(true)
    const began = Date.now()
    timer.current = setInterval(() => setSeconds(Math.floor((Date.now() - began) / 1000)), 250)
  }, [])

  const stop = useCallback(() => new Promise<Blob | null>(resolve => {
    const rec = recorder.current
    if (!rec) return resolve(null)
    rec.onstop = () => {
      const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' })
      release()
      resolve(blob.size ? blob : null)
    }
    rec.stop()
  }), [release])

  return { recording, seconds, start, stop, cancel: release }
}
