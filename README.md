This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

The app itself is **Unison HR** (`src/app/layout.tsx:17`): one tenant-aware Next.js 16 application that combines three product areas behind a REST API:

- **HRIS core**: employees, managers, org units (`/employees`, `/api/employees`).
- **Performance reviews**: review cycles and self-review submission (`/reviews`, `/api/review-cycles`).
- **Integration operations**: integration configs, queued jobs, retry, and an operator-triggered processing sweep (`/integrations`, `/api/integration-configs`, `/api/integration-jobs`).

There is no real login. A demo-session adapter (`src/lib/demo/demo-sessions.ts`) maps two request headers to one of five hard-coded users. Read [the auth doc](docs/architecture/auth-and-permissions.md) before treating anything here as production-safe.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

**Correction:** the repo only ships `package-lock.json`, so npm is the supported package manager. Every script in `package.json:5-14` calls a file inside `./node_modules/...` directly (for example `node ./node_modules/next/dist/bin/next dev`), so `npm install` must have run first. The yarn/pnpm/bun lines above are create-next-app boilerplate and were not checked.

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

**Correction:** the home page lives at `src/app/page.tsx`, not `app/page.tsx`. The project uses the `src/` layout.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel. (True: `src/app/layout.tsx:2` imports `Geist` and `Geist_Mono` from `next/font/google`.)

### Full local setup (database included)

The dev server alone is not enough. Every API route reads PostgreSQL through Prisma, so you need a database, a schema, and seed data.

| Step | Command | Grounding | Notes |
| --- | --- | --- | --- |
| 1. Install | `npm install` | `package.json` | Next 16.2.2, React 19.2.4, Prisma 7.7, Zod 4, Vitest 4. |
| 2. Start Postgres | `docker compose up -d` | `docker-compose.yml:3-14` | Creates database **`people_control_center`** on port 5432, user/password `postgres`/`postgres`. |
| 3. Create `.env` | `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/people_control_center?schema=public` | `prisma.config.ts:8`, `src/lib/db.ts:14-16` | There is no `.env.example` in the repo. See the warning below about the database name. |
| 4. Generate the client | `npm run db:generate` | `package.json:12` | Needed before `dev`, `build` or `test`; `src/lib/db.ts:8` imports `@prisma/client`. |
| 5. Create tables | `npm run db:push` | `package.json:13` | There is no `prisma/migrations/` folder. The schema is pushed, not migrated. |
| 6. Seed | `npm run db:seed` | `package.json:14`, `prisma/seed.ts` | Wipes every table first (`prisma/seed.ts:12-29`), then inserts the demo data. |
| 7. Run | `npm run dev` | `package.json:6` | |

**Database name warning (by reading).** `docker-compose.yml:7` creates `people_control_center`. The fallback in `src/lib/db.ts:16` is `.../unison_hr`. If you forget `DATABASE_URL`, the app will try to reach a database that the compose file never creates. `prisma.config.ts:8` uses `env("DATABASE_URL")`, so the Prisma CLI steps need the variable too. Always set `DATABASE_URL` explicitly.

**Seed script warning (by reading, not run).** `prisma/seed.ts:9` builds `new PrismaClient()` with no options, while the app client in `src/lib/db.ts:17-24` passes a `PrismaPg` driver adapter. Prisma 7 expects a driver adapter (or an Accelerate URL) when constructing the client, so the seed may fail at startup until it is given the same adapter. This was not executed here because no dependencies are installed in this checkout.

## Scripts

| Script | What it runs (`package.json`) | Notes |
| --- | --- | --- |
| `dev` | `next dev` (line 6) | |
| `build` | `next build` (line 7) | |
| `start` | `next start` (line 8) | |
| `lint` | `eslint src prisma.config.ts` (line 9) | `prisma/seed.ts` is not linted. |
| `test` | `vitest` (line 10) | Watch mode in a terminal; runs once in CI/non-TTY. |
| `test:run` | `vitest run --coverage` (line 11) | One-shot run with v8 coverage (`vitest.config.ts:12-15`). |
| `db:generate` | `prisma generate` (line 12) | |
| `db:push` | `prisma db push` (line 13) | |
| `db:seed` | `tsx prisma/seed.ts` (line 14) | |

## Demo sessions (who you are)

The shell has a role switcher (`src/components/shell/app-shell.tsx:81-90`). The selected user id is stored in `localStorage` under `hr-control-center-demo-session` (`src/lib/demo/demo-sessions.ts:11`) and sent on every API call as `x-demo-user-id` and `x-demo-tenant-id` (`src/lib/http/client.ts:47-53`).

| Session id | Tenant role | Platform role | Employee | Source |
| --- | --- | --- | --- | --- |
| `user_platform_admin` | TENANT_ADMIN | PLATFORM_ADMIN | none | `demo-sessions.ts:23-29` |
| `user_hr_admin` (default) | HR_ADMIN | NONE | `emp_alex` | `demo-sessions.ts:13-20,30` |
| `user_manager` | MANAGER | NONE | `emp_morgan` | `demo-sessions.ts:31-38` |
| `user_employee` | EMPLOYEE | NONE | `emp_sam` | `demo-sessions.ts:39-46` |
| `user_integration_admin` | INTEGRATION_ADMIN | NONE | `emp_ivy` | `demo-sessions.ts:47-54` |

All five sessions belong to `tenant_northstar`. The seed also creates `tenant_atlas` and `user_atlas_hr` (`prisma/seed.ts:39,79`), but there is **no demo session for the Atlas user**, so the only way to read Atlas data through the API is as the platform admin with `x-demo-tenant-id: tenant_atlas`.

**Important (run):** a request with no demo headers is treated as `user_hr_admin`, an HR admin (`src/lib/auth/session.ts:17-19`). See finding A1 in the auth doc.

## API surface

| Method and path | Handler | Service call | Who passes the gate (run) |
| --- | --- | --- | --- |
| `GET /api/employees` | `src/app/api/employees/route.ts:12-20` | `EmployeeService.listEmployees` | TENANT_ADMIN, HR_ADMIN, MANAGER, platform admin |
| `POST /api/employees` | `src/app/api/employees/route.ts:22-31` | `EmployeeService.createEmployee` | TENANT_ADMIN, HR_ADMIN, platform admin |
| `GET /api/employees/:employeeId` | `src/app/api/employees/[employeeId]/route.ts:18-27` | `EmployeeService.getEmployee` | TENANT_ADMIN, HR_ADMIN, MANAGER, platform admin |
| `PATCH /api/employees/:employeeId` | `src/app/api/employees/[employeeId]/route.ts:29-39` | `EmployeeService.updateEmployee` | TENANT_ADMIN, HR_ADMIN, platform admin |
| `GET /api/review-cycles` | `src/app/api/review-cycles/route.ts:11-19` | `ReviewService.listCycles` | everyone except INTEGRATION_ADMIN |
| `POST /api/review-cycles/:cycleId/submit-self-review` | `.../submit-self-review/route.ts:12-29` | `ReviewService.submitSelfReview` | any non-integration role with a linked employee and a SELF assignment |
| `GET /api/integration-configs` | `src/app/api/integration-configs/route.ts:11-19` | `IntegrationService.listConfigs` | TENANT_ADMIN, INTEGRATION_ADMIN, platform admin/support |
| `GET /api/integration-jobs` | `src/app/api/integration-jobs/route.ts:12-20` | `IntegrationService.listJobs` | same |
| `POST /api/integration-jobs` | `src/app/api/integration-jobs/route.ts:22-31` | `IntegrationService.queueJob` | same |
| `POST /api/integration-jobs/:jobId/retry` | `.../[jobId]/retry/route.ts:12-25` | `IntegrationService.retryJob` | same |
| `POST /api/integration-jobs/process` | `.../process/route.ts:12-21` | `runIntegrationJobSweep` -> `IntegrationService.processQueuedJobs` | same |

Every response is `{ data }` on success or `{ error: { message, details? } }` on failure (`src/lib/http/api-response.ts:11-41`). Invalid JSON or a Zod validation failure currently comes back as **500**, not 400 (finding A2 in the auth doc).

## Known issues (verified)

These are covered in detail, with evidence and fix sketches, in the docs. Short list:

1. Headerless requests act as HR admin (`src/lib/auth/session.ts:17-19`). (run)
2. Bad input returns 500 instead of 400 (`src/lib/http/api-response.ts:19-40`). (run with a stand-in for ZodError; Zod itself is not installed here)
3. Fixed: two concurrent "process queued jobs" calls could both claim and complete the same job. Claims are now conditional on `QUEUED` and carry a `claimToken` that `completeJob` must match (`src/repositories/integration-repository.ts:158-233`). (The original race was run against an in-memory db double.)
4. Fixed: two concurrent retries of the same failed job both succeeded. `queueRetry` now re-queues only a FAILED/RETRY_REQUIRED job and writes its log and audit in one transaction (`src/repositories/integration-repository.ts:111-156`). The losing request gets 404 where 409 would be accurate. (run, before the fix)
5. A crash mid-sweep leaves jobs stuck in `RUNNING`, and `RUNNING` jobs cannot be retried (`src/jobs/process-queued-integration-jobs.ts:24-50`, `src/services/integration-service.ts:88`). Still open: no reaper releases stale claims. (run)
6. Fixed at the write: an `APPROVED` self-review could be re-submitted. The service still blocks only `SUBMITTED` (`src/services/review-service.ts:68`), but the transaction's `updateMany` now requires `NOT_STARTED` or `IN_PROGRESS` (`src/repositories/review-repository.ts:106-123`). The caller gets 404 "Review assignment was not found for submission." rather than a 409. (run, before the fix)
7. The Reviews page shows "AVAILABLE" for every ACTIVE cycle even after you submitted (`src/hooks/useReviewCycles.ts:37-42`). (by reading)

## Where to go next

- [docs/architecture/README.md](docs/architecture/README.md): layers, file map, and which of the duplicate-looking service files are live.
- [docs/architecture/auth-and-permissions.md](docs/architecture/auth-and-permissions.md): the session adapter, gate tables, and the main findings.
- [docs/architecture/request-lifecycle.md](docs/architecture/request-lifecycle.md): every route, step by step, with failure status codes.
- [docs/architecture/domain-model.md](docs/architecture/domain-model.md): schema, enums, which states are actually reachable.
- [docs/learning/guided-reading-path.md](docs/learning/guided-reading-path.md): a reading order with check-yourself questions.
- [docs/learning/testing-rationale.md](docs/learning/testing-rationale.md): what the tests prove, and the checks run for these docs.
- [astraupskill/README.md](astraupskill/README.md): a short course on the review-submission and job-claim fixes (findings 3, 4 and 6).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

Note: `AGENTS.md` warns that this Next.js version (16.2.2) has breaking changes compared with older releases, and asks contributors to read `node_modules/next/dist/docs/` before writing code. One visible example in this repo is that dynamic route `params` are a `Promise` and must be awaited (`src/app/api/employees/[employeeId]/route.ts:12-21`).

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

Before deploying anything, note that the demo-session adapter accepts identity from plain request headers and falls back to an HR admin. It must be replaced with real authentication first.
