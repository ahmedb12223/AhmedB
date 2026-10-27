# Working in this repository

## What this app is

A single-process app: `server.ts` (Express) serves the React/Vite SPA through Vite
**dev middleware** and all `/api/*` endpoints on the same origin, port **3000**.

## Running it in the Base44 sandbox

```bash
docker compose -f docker-compose.base44.yml up -d --build   # or: up -d
docker compose -f docker-compose.base44.yml ps
curl -s http://localhost:3000/api/health
```

Everything runs in one `app` service (`oven/bun:1`, repo bind-mounted at `/app`,
`node_modules` in a docker volume, startup command `bun install --no-save && bun run dev`).

Non-obvious things worth knowing:

- **Package manager is bun**, pinned by `bun.lock` (there is no package-lock.json).
  `bun install --frozen-lockfile` **fails on a clean checkout**: the committed lockfile
  is out of date with `package.json` (it still lists a `firebase` dependency that was
  removed from the source). The startup command therefore uses `bun install --no-save`,
  which resolves from `package.json` and deliberately does not rewrite the tracked
  lockfile. Plain `npm install` does not work either — it rejects the peer range
  (`esbuild@^0.25.0` vs. `vite@8`'s `esbuild@^0.27 || ^0.28`).
- **`NODE_ENV` must not be `production`**: that branch serves a pre-built `dist/`
  bundle instead of the Vite dev middleware, which would freeze the code.
- **Data** is a JSON file at `./.data/db.json` (seeded with the teacher, 8 classes and
  a weekly schedule). It is committed to git and lives in the bind-mounted repo, so it
  persists across restarts. The app has no external database.
- **Firebase is not used.** `firebase-applet-config.json` and `src/utils/firebase.ts`
  are leftovers from AI Studio; `firebase.ts` exports `db = null` and keeps state in
  memory. Nothing imports the `firebase` package.
- **WhatsApp** is link based (chat links / wa.me). No credentials, no external API.
- **HMR is disabled on purpose** (`vite.config.ts` sets `hmr: false`, `ws: false`), so
  edits to `src/` need a page reload to show up; the Vite middleware re-transforms
  modules per request, so a reload is enough — no restart of the service is needed.

## Secrets

`GEMINI_API_KEY` comes from the platform-managed env file `/run/base44/app.env`
(declared last in `env_file:` so a dashboard value always wins). It is read only by
`/api/schedule/parse-ai` and `/api/ai/copilot`; the app boots without it (the copilot
answers with a canned reply, the AI parser returns 400).

## Environment variables

Only `GEMINI_API_KEY` (AI endpoints) and — in the sandbox — `BASE44_PREVIEW_MODE`,
`__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` (Vite host allowlist for the preview origin).
`APP_URL` from `.env.example` is not read by any code.

## Checks

- Type-check is the only lint: `docker compose -f docker-compose.base44.yml exec -T app bun run lint`
  (`tsc --noEmit`). There is no test suite.
- Smoke test: `curl -s http://localhost:3000/api/health` returns
  `{"status":"ok", ...}`; `/` returns the SPA HTML.
