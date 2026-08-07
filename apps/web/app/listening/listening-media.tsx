'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

import { AlertIcon, HeadphonesIcon } from '@/app/listening/listening-icons'
import type {
  ListeningMediaAsset,
  ListeningVisualAsset,
} from '@/lib/listening-api'
import { listeningApi } from '@/lib/listening-api'

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const

function useProtectedAsset(path: string) {
  const [state, setState] = useState<{
    path: string
    url: string | null
    error: string | null
  }>({ path, url: null, error: null })
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let objectUrl: string | null = null
    listeningApi
      .getAsset(path, controller.signal)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob)
        setState({ path, url: objectUrl, error: null })
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError')
          return
        setState({
          path,
          url: null,
          error:
            reason instanceof Error
              ? reason.message
              : 'بارگذاری فایل ناموفق بود.',
        })
      })
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [path, retryKey])

  const current = state.path === path ? state : { url: null, error: null }
  return {
    ...current,
    retry: () => {
      setState({ path, url: null, error: null })
      setRetryKey((value) => value + 1)
    },
  }
}

export function ListeningAudio({ asset }: { asset: ListeningMediaAsset }) {
  const { url, error, retry } = useProtectedAsset(asset.url)
  const [playbackRate, setPlaybackRate] = useState(1)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.defaultPlaybackRate = playbackRate
    audioRef.current.playbackRate = playbackRate
  }, [playbackRate, url])

  return (
    <section
      aria-labelledby={`audio-${asset.id}`}
      className="rounded-[1.75rem] border border-[#155e57]/20 bg-[#123f3b] p-5 text-white shadow-[0_18px_45px_rgba(21,94,87,0.18)] sm:p-6"
    >
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/12">
          <HeadphonesIcon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-[0.18em] text-[#b8d7d0]">
            RECORDING
          </p>
          <h2
            id={`audio-${asset.id}`}
            className="mt-1 truncate text-sm font-black"
          >
            {asset.title}
          </h2>
        </div>
      </div>
      {url ? (
        <audio
          ref={audioRef}
          controls
          preload="metadata"
          src={url}
          onLoadedMetadata={(event) => {
            event.currentTarget.defaultPlaybackRate = playbackRate
            event.currentTarget.playbackRate = playbackRate
          }}
          aria-label={`فایل صوتی ${asset.title}`}
          className="h-12 w-full min-w-0 max-w-full accent-[#f0ac87]"
        >
          مرورگر شما پخش فایل صوتی را پشتیبانی نمی‌کند.
        </audio>
      ) : error ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 rounded-xl bg-white/10 p-3 text-sm"
        >
          <span className="flex items-center gap-2">
            <AlertIcon className="size-5 shrink-0 text-[#f0ac87]" />
            {error}
          </span>
          <button
            type="button"
            onClick={retry}
            className="min-h-11 shrink-0 rounded-xl bg-white px-4 font-bold text-[#155e57] transition hover:bg-[#f4f1e8] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            تلاش دوباره
          </button>
        </div>
      ) : (
        <div
          aria-label="در حال بارگذاری فایل صوتی"
          className="h-12 animate-pulse rounded-full bg-white/10 motion-reduce:animate-none"
        />
      )}
      <div
        role="group"
        aria-label="سرعت پخش"
        className="mt-4 rounded-2xl bg-white/8 p-2"
      >
        <p className="mb-2 px-1 text-[11px] font-bold tracking-wide text-[#b8d7d0]">
          سرعت پخش
        </p>
        <div className="grid grid-cols-5 gap-1.5" dir="ltr">
          {PLAYBACK_RATES.map((rate) => (
            <button
              key={rate}
              type="button"
              aria-label={`سرعت پخش ${rate} برابر`}
              aria-pressed={playbackRate === rate}
              onClick={() => setPlaybackRate(rate)}
              className={`min-h-10 rounded-xl px-1 font-mono text-xs font-black tabular-nums transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white ${
                playbackRate === rate
                  ? 'bg-[#f0ac87] text-[#18302d] shadow-sm'
                  : 'bg-white/10 text-white hover:bg-white/18'
              }`}
            >
              {rate}×
            </button>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs leading-6 text-[#b8d7d0]">
        پخش خودکار نیست؛ هر زمان آماده بودی دکمهٔ پخش را بزن.
      </p>
    </section>
  )
}

export function ListeningVisual({ asset }: { asset: ListeningVisualAsset }) {
  const { url, error, retry } = useProtectedAsset(asset.url)

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
      >
        <div className="flex items-center gap-2">
          <AlertIcon className="size-5" />
          تصویر منبع بارگذاری نشد.
        </div>
        <button
          type="button"
          onClick={retry}
          className="mt-3 min-h-11 rounded-xl border border-red-300 px-4 font-bold"
        >
          تلاش دوباره
        </button>
      </div>
    )
  }

  return (
    <figure className="overflow-hidden rounded-2xl border border-[#18302d]/12 bg-[#f4f1e8] p-2">
      {url ? (
        <Image
          src={url}
          alt={asset.alt_text}
          width={asset.width ?? 800}
          height={asset.height ?? 520}
          unoptimized
          className="h-auto w-full rounded-xl"
        />
      ) : (
        <div
          style={{
            aspectRatio:
              asset.width && asset.height
                ? `${asset.width} / ${asset.height}`
                : '20 / 13',
          }}
          className="animate-pulse rounded-xl bg-[#dcebe5] motion-reduce:animate-none"
        />
      )}
      <figcaption className="px-3 py-2 text-xs leading-6 text-[#65716e]">
        {asset.title}
      </figcaption>
    </figure>
  )
}
