'use client'

type StaffTestPreviewCardProps = {
  error: string | null
  loading: boolean
  moduleLabel: string
  onOpen: () => void
}

function PreviewIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="size-6"
    >
      <path d="M9 3h6M10 3v5l-5.2 8.7A2.8 2.8 0 0 0 7.2 21h9.6a2.8 2.8 0 0 0 2.4-4.3L14 8V3" />
      <path d="M7.5 15h9" />
    </svg>
  )
}

export function StaffTestPreviewCard({
  error,
  loading,
  moduleLabel,
  onOpen,
}: StaffTestPreviewCardProps) {
  const headingId = `staff-${moduleLabel.toLowerCase()}-preview-title`

  return (
    <section
      aria-labelledby={headingId}
      className="mb-8 grid gap-4 rounded-[1.5rem] border border-dashed border-amber-700/30 bg-amber-50/75 p-5 text-[#3b2b1f] sm:grid-cols-[1fr_auto] sm:items-center sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-900 text-amber-50">
          <PreviewIcon />
        </span>
        <div>
          <p className="font-mono text-[10px] font-bold tracking-[0.16em] text-amber-800">
            STAFF · TEST TOOL
          </p>
          <h2 id={headingId} className="mt-1 text-lg font-black">
            پیش‌نمایش پایان آزمون {moduleLabel}
          </h2>
          <p className="mt-1 text-sm leading-7 text-amber-950/70">
            یک آزمون تکمیل‌شده با پاسخ و نتیجهٔ آماده باز کن؛ داده‌های واقعی
            کاربران تغییر نمی‌کنند.
          </p>
          {error && (
            <p role="alert" className="mt-2 text-sm font-bold text-red-800">
              {error}
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onOpen}
        disabled={loading}
        aria-describedby={headingId}
        className="min-h-12 cursor-pointer rounded-xl bg-amber-900 px-5 py-3 text-sm font-black text-white transition hover:bg-amber-950 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-amber-800 disabled:cursor-wait disabled:opacity-60"
      >
        {loading ? 'در حال آماده‌سازی…' : 'باز کردن نتیجهٔ آماده'}
      </button>
    </section>
  )
}
