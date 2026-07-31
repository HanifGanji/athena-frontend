import Link from 'next/link'

type ComingSoonSectionProps = {
  englishName: string
  persianName: string
  description: string
}

export function ComingSoonSection({
  englishName,
  persianName,
  description,
}: ComingSoonSectionProps) {
  return (
    <main className="grid min-h-svh place-items-center bg-[#f4f1e8] px-5 py-10 text-[#18302d]">
      <section className="w-full max-w-3xl rounded-[2.5rem] border border-[#18302d]/12 bg-[#fffdf8] p-7 shadow-[0_24px_80px_rgba(24,48,45,0.08)] sm:p-12">
        <div className="flex items-start justify-between gap-5">
          <p
            dir="ltr"
            className="font-mono text-xs tracking-[0.2em] text-[#a14e32]"
          >
            IELTS {englishName.toUpperCase()}
          </p>
          <span className="rounded-full bg-[#ece8dc] px-3 py-1.5 text-[11px] font-black text-[#59635f]">
            به‌زودی
          </span>
        </div>
        <h1 className="mt-14 text-5xl font-black tracking-[-0.04em] sm:text-7xl">
          {persianName}
        </h1>
        <p className="mt-6 max-w-xl text-base leading-8 text-[#65716e]">
          {description}
        </p>
        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-2xl bg-[#18302d] px-6 py-4 text-sm font-black text-white transition hover:bg-[#155e57] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#155e57]"
          >
            بازگشت به مهارت‌ها
          </Link>
          <Link
            href="/reading"
            className="rounded-2xl border border-[#155e57]/25 bg-[#dcebe5] px-6 py-4 text-sm font-black text-[#155e57] transition hover:border-[#155e57]/50"
          >
            تمرین Reading
          </Link>
        </div>
      </section>
    </main>
  )
}
