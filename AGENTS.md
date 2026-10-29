<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## SOUCLOU project rules

- Communicate and document in French.
- Treat student and family data as sensitive; use fictional data only.
- SOUCLOU targets Côte d'Ivoire: use French (`fr-CI`), `Africa/Abidjan`, and
  configurable school calendars; do not assume one national school-year date
  range or collect unnecessary learner data.
- Do not add secrets to source control, logs, or prompts. `.env.example` must
  contain placeholders only.
- Enforce authorization on the server for every read and write. Resolve the
  organization and school scope from authenticated, active memberships; never
  trust roles or tenant identifiers supplied by the browser.
- Test denied access and cross-school isolation whenever authorization or
  school-scoped data is introduced.
- Auth.js with Resend is the selected sign-in provider. Keep account approval
  and publication governance explicit and configurable; do not infer new
  approval rules.
- Keep the application local and use synthetic data until data-protection and
  hosting requirements for Côte d'Ivoire have been reviewed.
- Implement one small, tested increment at a time; do not generate the full
  application in one pass.
