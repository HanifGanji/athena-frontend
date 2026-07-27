# Repository guide

- Use Node.js 24 LTS and pnpm 11.17.0.
- Install with `npx --yes pnpm@11.17.0 install`.
- Start locally with `npx --yes pnpm@11.17.0 dev`.
- Keep `apps/web` mobile-first, responsive, and ready for Farsi/RTL content.
- Add shared packages only when more than one app or package needs them.

Before handing off changes, run:

```bash
npx --yes pnpm@11.17.0 format:check
npx --yes pnpm@11.17.0 lint
npx --yes pnpm@11.17.0 typecheck
npx --yes pnpm@11.17.0 test
npx --yes pnpm@11.17.0 build
```

Keep this file and `README.md` maintained as commands, tooling, or structure
change.
