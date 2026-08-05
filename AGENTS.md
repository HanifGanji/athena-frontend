# Repository guide

- Use Node.js 24 LTS and pnpm 11.17.0.
- Install with `npx --yes pnpm@11.17.0 install`.
- Start locally with `npx --yes pnpm@11.17.0 dev`.
- Keep `apps/web` mobile-first, responsive, and ready for Farsi/RTL content.
- Add shared packages only when more than one app or package needs them.
- Authentication uses credentialed Django sessions and CSRF. Run frontend and
  backend with the same hostname (`localhost` on both or `127.0.0.1` on both),
  and keep Reading, Speaking, Writing, and Listening behind the shared auth gate.
- The local OTP flow sends no SMS and accepts any six digits. Keep that warning
  visible in the UI until a real OTP provider replaces the development seam.

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

## Project skills

- [Git Contribution](skills/git/SKILL.md): Use for branches, commits, pull
  requests, merges, and post-merge branch cleanup.
- [UI/UX Pro Max](skills/ui-ux-pro-max/SKILL.md): Use for frontend UI design,
  implementation, refactoring, accessibility, responsive behavior, motion, or
  visual-quality reviews.
- [Apple Design](skills/apple-design/SKILL.md): Use for UI/UX audits and design
  reviews grounded in Apple Human Interface Guidelines, especially when
  reviewing screenshots, mockups, mobile/desktop conventions, or
  accessibility.

Read a selected skill's complete `SKILL.md` before acting, and resolve its
relative references from that skill's directory. The vendored source revisions
and licensing notes are recorded in `skills/README.md`.
