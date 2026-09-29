# 8. Verification

*Time: about 20 minutes for the test path, plus 15 if you also bring up PostgreSQL.*

## Setup from a clean checkout

You do not need a database to run any test in this course. You need one only if you want to open the app in a browser or apply the `claimToken` schema change.

```bash
# 1. Node. This project was built and verified on Node 22.16.0; anything >= 20.11 should work.
node --version

# 2. Dependencies, from the lockfile, in the project root (the folder holding package.json).
npm ci

# 3. Tests. No database, no environment variables needed.
npm test -- run --maxWorkers=1

# 4. Typecheck.
npx tsc --noEmit
```

`npm ci` installs exactly what `package-lock.json` pins and deletes any existing `node_modules` first; use `npm install` only if you deliberately want to move a version. If `npm ci` ends without generating the Prisma client (it can, when install scripts are disabled), run `npm run db:generate` — it reads `prisma/schema.prisma` and writes the typed client; it does **not** connect to a database, though Prisma's config may insist that `DATABASE_URL` be *set*, so export the placeholder from `.env.example` if it complains.

Only for the browser or for the schema change:

```bash
# 5. PostgreSQL 16 on localhost:5432 (see docker-compose.yml).
docker compose up -d

# 6. Point the app at it.
cp .env.example .env    # DATABASE_URL="postgresql://postgres:postgres@localhost:5432/people_control_center?schema=public"

# 7. Create the tables (see chapter 3 for what db push does and why it is not a migration).
npm run db:push

# 8. Seed the demo tenants, employees, cycles and queued jobs that the UI expects.
npm run db:seed

# 9. Run it.
npm run dev            # http://localhost:3000
```

The seed is what makes the demo session headers meaningful: `src/lib/http/client.ts` sends the user id and tenant id of a seeded demo session, so without step 8 every request 404s. If port 5432 is already taken on your machine, change the host side of the port mapping in `docker-compose.yml` and the port in `DATABASE_URL` together.

## The commands that produce the evidence

```bash
npm test -- run src/tests/auth-permissions.test.ts src/tests/review-transition.test.ts src/tests/tenant-isolation.test.ts src/tests/validation-boundaries.test.ts src/tests/workflow-atomicity.test.ts --maxWorkers=1
npx tsc --noEmit
```

Expected observation, as of the last run of this course's own suite:

```text
Test Files  5 passed (5)
     Tests  8 passed (8)
```

and `npx tsc --noEmit` printing nothing with exit code 0. `--maxWorkers=1` is not required for correctness; it keeps the output readable and avoids a slow cold start on a laptop. On Windows, macOS and Linux these two commands are identical — earlier versions of this chapter printed a `node_modules/.bin/vitest.mjs` path that does not exist in this project, and a `node_modules/.bin/tsc.cmd` path that only exists on Windows. Use `npm test --` and `npx`.

The four workflow tests cover: self-review audit rollback, one-winner concurrency on the real repository predicate, rejection of a mismatched subject employee, and immutable-token completion with stale-log suppression. The four older tests cover tenant isolation, permission boundaries, validation bounds and invalid review transitions.

## What this evidence does and does not establish

These are service and repository-contract tests. They run against an in-memory Prisma double (chapter 4 shows how it is built) and against hand-written repository fakes. They establish that:

- every predicate the change added is actually present in the `where` clause the repository sends;
- all three writes of a self-review submission sit inside one `$transaction` callback, so a failing audit insert discards the whole thing;
- the worker treats a `null` completion as "I no longer own this job" and writes no log.

They do **not** establish anything about PostgreSQL. Specifically they cannot show you: how the database behaves under `READ COMMITTED` versus `SERIALIZABLE`, whether two `updateMany` statements on the same row block or deadlock, what happens when a connection drops mid-transaction, or how two separate operating-system processes interleave. `Promise.all` in Node is cooperative scheduling, not parallelism.

The test that would close that gap looks like this, and is not written: a disposable database created per run, a unique tenant fixture so runs cannot collide, two independent connections (not two promises on one client), both calling `submitSelfReview` for the same assignment, then assertions made by a third connection reading committed rows — exactly one `reviewResponse`, exactly one `auditLog`, assignment `SUBMITTED`. Repeat with the worker: two processes claiming one job, then a `completeJob` from the loser. If you write it, keep it in a separate suite with its own command, because it needs `docker compose up -d` and the unit suite deliberately does not.

## Reading a test run honestly

Prefer the newest run, and re-run after every code edit rather than citing a run from before it. Keep failing runs you produced deliberately — the red-first exercise in chapter 5 is more informative than any green run — but never cite one as proof the code works.

When a test run and a claim in prose disagree, the test run wins, and the prose gets fixed. If the suite grows from five files to six, update the command, the expected counts and the summary above together; a chapter that prints a command nobody has run is worse than no command at all.

Two failure modes specific to this project:

- **A green suite with a stale Prisma client.** If you changed `schema.prisma` and did not re-run `npm run db:generate`, `npx tsc --noEmit` is the check that catches it, not the tests — the tests mock the client away.
- **A green suite that proves nothing.** If you can delete a predicate from a `where` clause and the suite still passes, the test is asserting the fake's behaviour rather than the code's. Chapter 4 explains the discriminator; chapter 5 exercise D makes you watch it fail.
