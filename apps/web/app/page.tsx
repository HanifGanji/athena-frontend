import Link from 'next/link'

import { HomeAuthControls } from '@/app/home-auth-controls'

const modules = [
  {
    name: 'Reading',
    faName: 'درک مطلب',
    href: '/reading',
    description:
      'متن‌های استاندارد، پاسخ‌گویی زمان‌دار و تحلیل فارسی مبتنی بر شواهد.',
    detail: 'تمرین فعال',
    accent: 'bg-[#155e57] text-white',
    active: true,
  },
  {
    name: 'Writing',
    faName: 'نوشتن',
    href: '/writing',
    description: 'تمرین Task 1 و Task 2 با بازخورد مرحله‌به‌مرحله.',
    detail: 'تمرین فعال',
    accent: 'bg-[#155e57] text-white',
    active: true,
  },
  {
    name: 'Listening',
    faName: 'شنیداری',
    href: '/listening',
    description: 'تمرین شنیدن، یادداشت‌برداری و تشخیص پاسخ در زمان واقعی.',
    detail: 'به‌زودی',
    accent: 'bg-[#f3dfd6] text-[#8d4028]',
    active: false,
  },
  {
    name: 'Speaking',
    faName: 'مکالمه',
    href: '/speaking',
    description:
      'ضبط و بازبینی پاسخ انگلیسی و شنیدن پاسخ صوتی ممتحن، بدون نمایش متن.',
    detail: 'تمرین فعال',
    accent: 'bg-[#e57d55] text-white',
    active: true,
  },
] as const

export default function HomePage() {
  return (
    <main className="relative min-h-svh overflow-hidden bg-[#f4f1e8] text-[#18302d]">
      <div
        aria-hidden="true"
        className="absolute -top-32 -left-24 size-80 rounded-full bg-[#dcebe5] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute top-72 -right-40 size-96 rounded-full bg-[#f3dfd6]/70 blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl px-5 py-7 sm:px-8 lg:py-10">
        <header className="flex items-center justify-between border-b border-[#18302d]/15 pb-5">
          <Link href="/" aria-label="صفحهٔ اصلی آتنا">
            <p className="font-mono text-[10px] tracking-[0.25em] text-[#a14e32]">
              ATHENA · IELTS LAB
            </p>
            <p className="mt-1 text-2xl font-black">آتنا</p>
          </Link>
          <HomeAuthControls />
        </header>

        <section className="grid gap-10 py-14 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:py-24">
          <div>
            <p className="mb-5 text-sm font-bold text-[#a14e32]">
              مسیر شخصی تو برای IELTS
            </p>
            <h1 className="max-w-4xl text-5xl leading-[1.12] font-black tracking-[-0.04em] sm:text-7xl lg:text-8xl">
              انگلیسی را
              <span className="block text-[#155e57]">با فکر یاد بگیر.</span>
            </h1>
          </div>
          <div className="space-y-6">
            <p className="max-w-xl text-base leading-8 text-[#52625f] lg:text-lg">
              از Reading، Writing یا Speaking شروع کن. آتنا عملکردت را ثبت
              می‌کند تا هر تمرین، قدم بعدی را روشن‌تر کند؛ Listening هم در راه
              است.
            </p>
            <a
              href="#modules"
              className="inline-flex rounded-2xl bg-[#18302d] px-6 py-4 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#155e57] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#155e57]"
            >
              انتخاب مهارت ↓
            </a>
          </div>
        </section>

        <section
          id="modules"
          aria-labelledby="modules-title"
          className="scroll-mt-8 pb-20"
        >
          <div className="mb-6 flex items-end justify-between gap-5">
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-[#6f7f7b]">
                IELTS SKILLS
              </p>
              <h2 id="modules-title" className="mt-2 text-3xl font-black">
                کدام مهارت را تمرین می‌کنی؟
              </h2>
            </div>
            <span className="hidden font-mono text-xs text-[#6f7f7b] sm:block">
              03 ACTIVE · 01 NEXT
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {modules.map((module, index) => (
              <Link
                key={module.name}
                href={module.href}
                className="group flex min-h-64 flex-col justify-between rounded-[2rem] border border-[#18302d]/12 bg-[#fffdf8] p-6 shadow-[0_16px_50px_rgba(24,48,45,0.06)] transition hover:-translate-y-1 hover:border-[#155e57]/35 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#155e57] sm:p-8"
              >
                <div className="flex items-start justify-between gap-4">
                  <span
                    className={`rounded-full px-3 py-1.5 text-[11px] font-black ${module.accent}`}
                  >
                    {module.detail}
                  </span>
                  <span className="font-mono text-xs text-[#88928f]">
                    {(index + 1).toString().padStart(2, '0')}
                  </span>
                </div>
                <div>
                  <p
                    dir="ltr"
                    className="font-mono text-xs tracking-[0.2em] text-[#a14e32]"
                  >
                    IELTS {module.name.toUpperCase()}
                  </p>
                  <h3 className="mt-2 text-4xl font-black sm:text-5xl">
                    {module.faName}
                  </h3>
                  <p className="mt-4 max-w-lg text-sm leading-7 text-[#65716e]">
                    {module.description}
                  </p>
                  <p className="mt-6 text-sm font-black text-[#155e57]">
                    {module.active
                      ? `ورود به ${module.name}`
                      : 'مشاهدهٔ برنامه'}
                    <span className="mr-2 inline-block transition group-hover:-translate-x-1">
                      ←
                    </span>
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
