import type { SpeakingSession, SpeakingTurn } from '@/lib/speaking-api'

import type { SpeakingPhase } from './speaking-machine'
import { HeadphonesIcon, PlayIcon, Spinner } from './speaking-icons'
import { formatDuration, stageLabel } from './speaking-transcript'

type SpeakingExaminerProps = {
  onPlay: () => void
  phase: SpeakingPhase
  prompt: SpeakingTurn | null
  session: SpeakingSession
  speechUrl: string | null
}

function phaseText(phase: SpeakingPhase) {
  if (phase === 'loading_examiner') return 'در حال آماده‌سازی صدا'
  if (phase === 'playing_examiner') return 'در حال پخش'
  if (phase === 'examiner_ready') return 'آمادهٔ پخش'
  if (phase === 'generating_next') return 'در حال ساخت سؤال بعدی'
  if (phase === 'submitting') return 'در حال تبدیل پاسخ به متن'
  return 'نوبت شما'
}

export function SpeakingExaminer({
  onPlay,
  phase,
  prompt,
  session,
  speechUrl,
}: SpeakingExaminerProps) {
  const loading = [
    'loading_examiner',
    'generating_next',
    'submitting',
  ].includes(phase)
  const canPlay = Boolean(speechUrl) && phase !== 'playing_examiner'
  const repeatHidden = prompt?.kind === 'repeat_sentence' && prompt.is_hidden

  return (
    <section
      aria-labelledby="examiner-stage-title"
      className="relative overflow-hidden rounded-[1.75rem] bg-[var(--athena-ink)] p-5 text-white shadow-[0_24px_70px_rgba(24,48,45,0.18)] sm:p-7"
    >
      <div
        aria-hidden="true"
        className="absolute -top-24 -left-20 size-64 rounded-full bg-[#28756c]/35 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -right-20 -bottom-24 size-72 rounded-full bg-[#b25b3d]/20 blur-3xl"
      />

      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--athena-coral)]">
              {prompt ? stageLabel(prompt.stage) : 'SPEAKING SESSION'}
            </p>
            <h2 id="examiner-stage-title" className="mt-2 text-xl font-black">
              ممتحن آتنا
            </h2>
          </div>
          <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 text-[10px] font-black text-[#dcebe5]">
            <span
              aria-hidden="true"
              className={`size-2 rounded-full ${
                phase === 'playing_examiner'
                  ? 'animate-pulse bg-[#78d7c9] motion-reduce:animate-none'
                  : 'bg-white/40'
              }`}
            />
            {phaseText(phase)}
          </span>
        </div>

        <div className="grid min-h-[19rem] place-items-center py-8 text-center sm:min-h-[22rem]">
          <div className="w-full max-w-2xl">
            <div className="mx-auto grid size-20 place-items-center rounded-full border border-white/15 bg-white/10 sm:size-24">
              {loading ? (
                <Spinner className="size-7" />
              ) : phase === 'playing_examiner' ? (
                <span
                  className="flex h-8 items-center gap-1"
                  aria-hidden="true"
                >
                  {[13, 24, 18, 30, 16, 26].map((height, index) => (
                    <span
                      key={`${height}-${index}`}
                      className="w-1 animate-pulse rounded-full bg-[#78d7c9] motion-reduce:animate-none"
                      style={{ height, animationDelay: `${index * 80}ms` }}
                    />
                  ))}
                </span>
              ) : (
                <HeadphonesIcon className="size-8 text-[#dcebe5]" />
              )}
            </div>

            {prompt ? (
              repeatHidden ? (
                <div className="mx-auto mt-6 max-w-lg rounded-2xl border border-dashed border-white/20 bg-black/10 px-5 py-5">
                  <p className="text-sm font-black">فقط گوش کن و تکرار کن</p>
                  <p className="mt-2 text-xs leading-6 text-[#b8c7c3]">
                    برای وفاداری به ساختار TOEFL، متن جمله بعد از ثبت پاسخت
                    نمایش داده می‌شود.
                  </p>
                </div>
              ) : (
                <p
                  dir="ltr"
                  lang="en"
                  className="mx-auto mt-6 max-w-2xl whitespace-pre-line text-left text-lg leading-8 font-semibold text-[#f6faf8] sm:text-xl sm:leading-9"
                >
                  {prompt.transcript}
                </p>
              )
            ) : (
              <p className="mt-6 text-sm text-[#b8c7c3]">
                جلسه را برای سؤال بعدی آماده می‌کنیم.
              </p>
            )}

            {prompt?.suggested_duration_ms && (
              <p className="mt-5 text-xs text-[#a8b8b4]">
                {session.exam_type === 'ielts'
                  ? 'پیشنهاد آتنا'
                  : 'زمان پیشنهادی'}
                :{' '}
                <span dir="ltr" className="font-mono font-bold text-white">
                  {formatDuration(prompt.suggested_duration_ms)}
                </span>
              </p>
            )}

            {canPlay && (
              <button
                type="button"
                onClick={onPlay}
                className="mx-auto mt-6 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--athena-coral)] px-6 py-3 text-sm font-black text-[#3a2119] shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:bg-[#ffc4a3] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white motion-reduce:transform-none"
              >
                <PlayIcon className="size-5" />
                پخش صدای ممتحن
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-[11px] text-[#b8c7c3]">
          <p>ضبط تا پایان پخش صدای ممتحن غیرفعال است.</p>
          <p dir="ltr" className="font-mono">
            {session.response_count}/{session.required_response_count} RESPONSES
          </p>
        </div>
      </div>
    </section>
  )
}
