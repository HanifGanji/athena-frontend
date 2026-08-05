import Link from 'next/link'

import type {
  SpeakingExamType,
  SpeakingSessionSummary,
} from '@/lib/speaking-api'

import { SpeakingHistory } from './speaking-history'
import {
  CheckIcon,
  HeadphonesIcon,
  MicrophoneIcon,
  ShieldIcon,
  Spinner,
} from './speaking-icons'
import type { MicrophoneState, SpeakingPhase } from './speaking-machine'

type SpeakingLandingProps = {
  error: string | null
  examType: SpeakingExamType
  microphone: MicrophoneState
  onCheckMicrophone: () => void
  onInspect: (session: SpeakingSessionSummary) => void
  onResume: (session: SpeakingSessionSummary) => void
  onSelectExam: (examType: SpeakingExamType) => void
  onStart: () => void
  phase: SpeakingPhase
  sessions: SpeakingSessionSummary[]
}

function microphoneCopy(state: MicrophoneState) {
  if (state === 'ready') return 'میکروفن آماده است'
  if (state === 'denied') return 'دسترسی میکروفن داده نشد'
  if (state === 'unavailable') return 'میکروفن در دسترس نیست'
  if (state === 'checking') return 'در حال بررسی میکروفن…'
  return 'پیش از شروع، میکروفن را بررسی کن'
}

export function SpeakingLanding({
  error,
  examType,
  microphone,
  onCheckMicrophone,
  onInspect,
  onResume,
  onSelectExam,
  onStart,
  phase,
  sessions,
}: SpeakingLandingProps) {
  const starting = phase === 'creating_session'
  const checking = phase === 'checking_microphone'

  return (
    <main className="relative min-h-svh overflow-hidden bg-[var(--athena-canvas)] text-[var(--athena-ink)]">
      <div
        aria-hidden="true"
        className="absolute -top-40 -left-24 size-[28rem] rounded-full bg-[var(--athena-mint)] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -right-48 bottom-24 size-[32rem] rounded-full bg-[var(--athena-peach)] opacity-75 blur-3xl"
      />
      <div className="relative mx-auto max-w-6xl px-5 py-7 sm:px-8 lg:py-10">
        <header className="flex items-center justify-between gap-4 border-b border-[var(--athena-border)] pb-5">
          <Link
            href="/"
            aria-label="بازگشت به صفحهٔ اصلی"
            className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--athena-teal)]"
          >
            <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--athena-rust)]">
              ATHENA · SPEAKING
            </p>
            <p className="mt-1 text-2xl font-black">آتنا</p>
          </Link>
          <span className="rounded-full border border-[var(--athena-border-strong)] bg-white/65 px-4 py-2 text-xs font-black text-[var(--athena-teal)]">
            تمرین استانداردمحور
          </span>
        </header>

        <section className="grid items-end gap-9 py-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14 lg:py-16">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--athena-border-strong)] bg-[var(--athena-mint)] px-4 py-2 text-xs font-black text-[var(--athena-teal)]">
              <HeadphonesIcon className="size-4" />
              گوش کن، ضبط کن، با تمرکز ادامه بده
            </div>
            <h1 className="max-w-3xl text-5xl leading-[1.12] font-black tracking-[-0.045em] sm:text-7xl">
              مکالمه را
              <span className="block text-[var(--athena-teal)]">
                به تجربه تبدیل کن.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--athena-muted)]">
              یک جلسهٔ کامل و مرحله‌به‌مرحله برای IELTS یا نسخهٔ فعلی TOEFL؛
              صدای ممتحن را می‌شنوی، پاسخت را قبل از ثبت بازبینی می‌کنی و بعداً
              متن انگلیسی جلسه را در اختیار داری.
            </p>
            <div className="mt-7 flex max-w-2xl items-start gap-3 rounded-2xl border border-[var(--athena-peach-border)] bg-[var(--athena-peach)] p-4 text-sm leading-7 text-[var(--athena-rust-dark)]">
              <ShieldIcon className="mt-1 size-5 shrink-0" />
              <p>
                <strong>تمرین استانداردمحور، نه آزمون رسمی.</strong> در این نسخه
                نمره، بازخورد یا تخمین باند ارائه نمی‌شود.
              </p>
            </div>
          </div>

          <section
            aria-labelledby="microphone-check-title"
            className="rounded-[1.75rem] border border-[var(--athena-border)] bg-[var(--athena-paper)] p-5 shadow-[0_22px_70px_rgba(24,48,45,0.09)] sm:p-7"
          >
            <div className="flex items-start gap-4">
              <span
                className={`grid size-12 shrink-0 place-items-center rounded-2xl ${
                  microphone === 'ready'
                    ? 'bg-[var(--athena-mint)] text-[var(--athena-teal)]'
                    : 'bg-[var(--athena-sand)] text-[var(--athena-muted)]'
                }`}
              >
                {checking ? (
                  <Spinner />
                ) : microphone === 'ready' ? (
                  <CheckIcon />
                ) : (
                  <MicrophoneIcon />
                )}
              </span>
              <div>
                <h2 id="microphone-check-title" className="text-lg font-black">
                  بررسی صدا پیش از شروع
                </h2>
                <p className="mt-2 text-sm leading-7 text-[var(--athena-muted)]">
                  {microphoneCopy(microphone)}. در صورت نیاز، هنگام ضبط هم
                  می‌توانی از فایل صوتی استفاده کنی.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onCheckMicrophone}
              disabled={checking || starting}
              className="mt-5 min-h-12 w-full rounded-2xl border border-[var(--athena-border-strong)] bg-white px-5 py-3 text-sm font-black transition hover:border-[var(--athena-teal)] hover:bg-[var(--athena-mint)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--athena-teal)] disabled:cursor-wait disabled:opacity-55"
            >
              {checking ? 'در حال بررسی…' : 'بررسی میکروفن'}
            </button>
            <p className="mt-4 text-[11px] leading-6 text-[var(--athena-muted)]">
              صدا برای تبدیل گفتار به متن و پخش ممتحن به‌صورت موقت به سرویس
              پردازش ارسال می‌شود؛ فایل صوتی ذخیره نمی‌شود و فقط متن انگلیسی
              جلسه می‌ماند.
            </p>
          </section>
        </section>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm leading-7 text-red-800"
          >
            {error}
          </div>
        )}

        <section aria-labelledby="exam-choice-title" className="pb-7">
          <div className="mb-5">
            <p className="text-xs font-bold tracking-[0.14em] text-[var(--athena-rust)]">
              انتخاب مسیر
            </p>
            <h2 id="exam-choice-title" className="mt-2 text-2xl font-black">
              کدام ساختار را تمرین می‌کنی؟
            </h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {(
              [
                {
                  type: 'ielts' as const,
                  title: 'IELTS Speaking',
                  count: '۱۶ پاسخ',
                  description:
                    '۹ سؤال آشنا در Part 1، یک Long Turn و یک پیگیری در Part 2، سپس ۵ سؤال تحلیلی در Part 3.',
                  detail: 'سه بخش · بدون توقف خودکار',
                },
                {
                  type: 'toefl' as const,
                  title: 'TOEFL Speaking · Current',
                  count: '۱۱ پاسخ',
                  description:
                    '۷ جملهٔ Listen and Repeat با طول افزایشی، سپس ۴ سؤال در یک گفت‌وگوی دانشگاهی یا محیط پردیس.',
                  detail: 'فرمت فعلی پس از ژانویهٔ ۲۰۲۶',
                },
              ] as const
            ).map((card) => {
              const selected = examType === card.type
              return (
                <article
                  key={card.type}
                  className={`rounded-[1.75rem] border p-5 transition sm:p-6 ${
                    selected
                      ? 'border-[var(--athena-teal)] bg-[var(--athena-mint)] shadow-[0_16px_45px_rgba(21,94,87,0.1)]'
                      : 'border-[var(--athena-border)] bg-[var(--athena-paper)] hover:border-[var(--athena-border-strong)]'
                  }`}
                >
                  <button
                    type="button"
                    aria-label={`${card.title} practice`}
                    aria-pressed={selected}
                    onClick={() => onSelectExam(card.type)}
                    className="w-full rounded-xl text-right focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--athena-teal)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3
                          dir="ltr"
                          lang="en"
                          className="text-left text-xl font-black"
                        >
                          {card.title}
                        </h3>
                        <p className="mt-1 text-right text-xs font-black text-[var(--athena-rust)]">
                          {card.detail}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-[var(--athena-teal)]">
                        {card.count}
                      </span>
                    </div>
                    <p className="mt-5 text-sm leading-7 text-[var(--athena-muted)]">
                      {card.description}
                    </p>
                  </button>
                  {selected && (
                    <button
                      type="button"
                      onClick={onStart}
                      disabled={starting}
                      className="mt-5 flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--athena-ink)] px-6 py-3 text-sm font-black text-white transition hover:bg-[var(--athena-teal)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--athena-teal)] disabled:cursor-wait disabled:opacity-60"
                    >
                      {starting ? (
                        <Spinner />
                      ) : (
                        <HeadphonesIcon className="size-5" />
                      )}
                      {starting
                        ? 'در حال ساخت جلسه…'
                        : `شروع تمرین ${card.title.split(' ')[0]}`}
                    </button>
                  )}
                </article>
              )
            })}
          </div>
        </section>

        <SpeakingHistory
          sessions={sessions}
          onResume={onResume}
          onInspect={onInspect}
        />
      </div>
    </main>
  )
}
