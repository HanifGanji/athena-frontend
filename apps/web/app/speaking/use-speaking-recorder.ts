'use client'

import { useEffect, useRef, useState } from 'react'

import type { PreparedTake } from './speaking-recorder'
import type { RecorderMode, SpeakingPhase } from './speaking-machine'

type UseSpeakingRecorderProps = {
  onError: (message: string) => void
  onPhase: (phase: SpeakingPhase) => void
  onPrepared: (take: PreparedTake) => void
  recorderMode: RecorderMode
}

function recordingFilename(mimeType: string) {
  if (mimeType.includes('mp4')) return 'athena-speaking.mp4'
  if (mimeType.includes('ogg')) return 'athena-speaking.ogg'
  return 'athena-speaking.webm'
}

function metadataDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const previewUrl = URL.createObjectURL(file)
    const audio = new Audio()
    const cleanup = () => {
      audio.removeAttribute('src')
      URL.revokeObjectURL(previewUrl)
    }
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      const duration = Math.round(audio.duration * 1000)
      cleanup()
      if (Number.isFinite(duration) && duration >= 250) resolve(duration)
      else reject(new Error('invalid duration'))
    }
    audio.onerror = () => {
      cleanup()
      reject(new Error('metadata unavailable'))
    }
    audio.src = previewUrl
  })
}

export function useSpeakingRecorder({
  onError,
  onPhase,
  onPrepared,
  recorderMode,
}: UseSpeakingRecorderProps) {
  const [elapsedMs, setElapsedMs] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef<number | null>(null)
  const mountedRef = useRef(true)
  const discardRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      const recorder = recorderRef.current
      if (recorder) {
        recorder.ondataavailable = null
        recorder.onstop = null
        if (recorder.state !== 'inactive') recorder.stop()
      }
      stopTracks()
    }
  }, [])

  useEffect(() => {
    if (recorderMode !== 'recording') return
    const update = () => {
      if (startedAtRef.current !== null) {
        setElapsedMs(
          Math.max(0, Math.round(performance.now() - startedAtRef.current)),
        )
      }
    }
    update()
    const interval = window.setInterval(update, 200)
    return () => window.clearInterval(interval)
  }, [recorderMode])

  async function startRecording() {
    if (!['ready', 'review', 'error'].includes(recorderMode)) return
    if (
      typeof MediaRecorder === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      onError(
        'ضبط مستقیم در این مرورگر در دسترس نیست. یک فایل صوتی انتخاب کنید.',
      )
      return
    }

    onPhase('requesting_permission')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      const recorder = new MediaRecorder(stream)
      streamRef.current = stream
      recorderRef.current = recorder
      chunksRef.current = []
      discardRef.current = false
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const durationMs = Math.max(
          250,
          Math.round(
            performance.now() - (startedAtRef.current ?? performance.now()),
          ),
        )
        const mimeType =
          recorder.mimeType || chunksRef.current[0]?.type || 'audio/webm'
        if (
          mountedRef.current &&
          !discardRef.current &&
          chunksRef.current.length
        ) {
          const blob = new Blob(chunksRef.current, { type: mimeType })
          onPrepared({
            blob,
            clientEventId: crypto.randomUUID(),
            durationMs,
            filename: recordingFilename(mimeType),
            label: 'پاسخ ضبط‌شده',
            previewUrl: URL.createObjectURL(blob),
          })
          onPhase('local_review')
        } else if (mountedRef.current && !discardRef.current) {
          onError('صدایی ضبط نشد. دوباره تلاش کنید یا فایل صوتی انتخاب کنید.')
        }
        chunksRef.current = []
        startedAtRef.current = null
        recorderRef.current = null
        stopTracks()
      }
      recorder.start()
      startedAtRef.current = performance.now()
      setElapsedMs(0)
      onPhase('recording')
    } catch (reason) {
      stopTracks()
      recorderRef.current = null
      startedAtRef.current = null
      const denied =
        reason instanceof DOMException && reason.name === 'NotAllowedError'
      onError(
        denied
          ? 'اجازهٔ میکروفن داده نشد. دسترسی مرورگر را فعال کنید یا فایل صوتی انتخاب کنید.'
          : 'میکروفن آماده نشد. اتصال دستگاه را بررسی کنید یا فایل صوتی انتخاب کنید.',
      )
    }
  }

  function stopRecording(discard = false) {
    discardRef.current = discard
    onPhase('stopping_recording')
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    else {
      stopTracks()
      onPhase(discard ? 'ready_to_record' : 'recoverable_error')
    }
  }

  async function chooseFile(file: File | undefined) {
    if (!file) return
    onPhase('stopping_recording')
    try {
      const durationMs = await metadataDuration(file)
      if (!mountedRef.current) return
      onPrepared({
        blob: file,
        clientEventId: crypto.randomUUID(),
        durationMs,
        filename: file.name,
        label: file.name,
        previewUrl: URL.createObjectURL(file),
      })
      onPhase('local_review')
    } catch {
      if (mountedRef.current) {
        onError(
          'مدت فایل صوتی خوانده نشد. فایل دیگری انتخاب کنید یا پاسخ را ضبط کنید.',
        )
      }
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return {
    chooseFile,
    elapsedMs,
    fileInputRef,
    startRecording,
    stopRecording,
  }
}
