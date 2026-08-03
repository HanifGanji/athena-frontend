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
Reading, Writing, and Speaking are functional; Listening currently shows a
product placeholder. The home page stays public, while all four module routes
require an authenticated session.

The Reading, Writing, and Speaking clients use `NEXT_PUBLIC_API_BASE_URL`,
defaulting locally to `http://localhost:8000/api/v1`.

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

The authenticated `/speaking` practice workspace offers an explicit
record/stop flow for IELTS or TOEFL practice, lets the learner review or
re-record locally before sending, and plays only the AI-generated examiner
voice reply. The learner audio and its transient transcription are not saved or
returned to the browser. Audio-file upload remains available as a quiet
microphone fallback. This demo route needs request throttling before public,
paid-provider use.

The authenticated `/writing` workspace lists published single tasks and full
mocks, displays the original English prompt beside an LTR editor, counts words,
shows the IELTS timer, and debounces autosave. Draft saves use optimistic
revision numbers and expose an explicit choice if another tab has saved a newer
version. Submission is reviewed and immutable; below-minimum work can still be
submitted with a realistic warning. AI feedback is requested separately after
submission and renders criterion estimates, strengths, improvements, exact
essay excerpts, suggested rewrites, and prioritized practice actions. The UI
labels every band as an educational estimate and explains the daily feedback
allowance; ordinary drafting never calls AI.

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
