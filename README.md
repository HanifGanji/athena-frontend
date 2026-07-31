# آتنا — Frontend

Responsive, RTL-ready web client built as a pnpm/Turborepo monorepo with Next.js,
React, TypeScript, and Tailwind CSS.

## Local development

Use Node.js 24 LTS.

```bash
npx --yes pnpm@11.17.0 install
npx --yes pnpm@11.17.0 dev
```

Open http://localhost:3000.

The home page links to `/reading`, `/writing`, `/listening`, and `/speaking`.
Reading is functional; the other skill routes currently show product placeholders.

The Reading client uses `NEXT_PUBLIC_API_BASE_URL`, defaulting locally to
`http://localhost:8000/api/v1`.

Useful checks:

```bash
npx --yes pnpm@11.17.0 format:check
npx --yes pnpm@11.17.0 lint
npx --yes pnpm@11.17.0 typecheck
npx --yes pnpm@11.17.0 test
npx --yes pnpm@11.17.0 build
```

`apps/web` contains the web app. `packages/` contains shared tooling
configuration.

Keep this README and `AGENTS.md` current when setup or workflows change.
