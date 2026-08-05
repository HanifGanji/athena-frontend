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
Reading and Speaking are functional; Writing and Listening currently show
product placeholders. The home page stays public, while all four module routes
require an authenticated session.

The Reading and Speaking clients use `NEXT_PUBLIC_API_BASE_URL`, defaulting locally to
`http://localhost:8000/api/v1`.

### Development authentication

Open `/auth` to register with a phone number, first name, last name, and email,
or to log in with an existing phone number. The development OTP flow does not
send an SMS: after requesting a code, enter any six digits. This is intentionally
insecure and must remain a local-only workflow until real code generation, SMS,
throttling, and account ownership controls are implemented.

Authentication uses Django server-side sessions and CSRF cookies. Always run
the frontend and backend with the same hostname so the browser can share those
cookies across ports:

- `http://localhost:3000` with `http://localhost:8000`, or
- `http://127.0.0.1:3000` with `http://127.0.0.1:8000`.

Do not mix `localhost` and `127.0.0.1`. The backend must also allow the chosen
frontend origin with credentialed CORS. When using `127.0.0.1`, set
`NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/v1`. After pulling the custom-user migration,
reset disposable local SQLite or Docker PostgreSQL data as described in the
backend README, rerun migrations, and reseed the Reading demo before registering
through the UI.

The authenticated `/speaking` experience provides complete, resumable IELTS
and current-format TOEFL sessions. It checks microphone access, plays each
saved examiner turn, keeps recording disabled until playback finishes, and
offers an explicit record, review, discard, re-record, or audio-file fallback
before submission. Recording never auto-stops; accepted duration is measured
and compared with Athena's suggested timing without scoring the learner.

Committed English turns persist in a responsive transcript and recent-session
history. An active TOEFL Listen and Repeat sentence stays hidden until the
response is submitted. Navigation preserves in-progress sessions, while a
separate confirmed action abandons them. Audio is sent transiently for STT/TTS
and never stored; the English transcript and session timing are saved. Provider,
authentication, and rate-limit failures expose nearby recoverable actions.

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

## Project design skills

The repository vendors two shared design skills under `skills/` so every
developer and coding agent receives the same guidance:

- `skills/ui-ux-pro-max/` provides searchable UI/UX design intelligence and
  Next.js-specific implementation guidance.
- `skills/apple-design/` provides design-review workflows and cross-platform
  Human Interface Guidelines references.

The repository-local `skills/git/` skill defines the required pull request,
squash-merge, and source-branch cleanup workflow.

Their usage triggers are registered in `AGENTS.md`; source revisions and
licensing notes are documented in `skills/README.md`.

Keep this README and `AGENTS.md` current when setup or workflows change.
