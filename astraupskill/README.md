# Review and integration workflow course

This course follows two high-risk write paths in an existing Next.js + Prisma HR application: an employee submitting a self-review, and a background worker claiming an integration job. Both were blind updates; both are now guarded, transactional claims. Every example names the real file and function, so you can open the implementation beside the lesson.

## Prerequisites

You will get the most out of this if you already have:

- **JavaScript/TypeScript**: `async`/`await`, promises, destructuring, and reading a class.
- **Any SQL database, at a basic level**: rows, primary keys, `UPDATE ... WHERE`, and what an index is for. You do not need to write SQL here.
- **Some exposure to an ORM.** Prisma specifics are explained where they matter, but you should have seen `create`/`update`/`findMany`-style calls before.
- **A terminal**: running `npm` scripts and reading a test summary.

You do **not** need: Next.js App Router knowledge (there is one route handler and it is nine lines), React (one component appears, in the trace lab), Docker (only for the optional browser run), or prior experience with transactions — that is what the course is for. Every unfamiliar term used in the chapters is defined in the glossary at the end of [chapter 2](02-CONCEPTS.md).

## Chapters, in order

| # | File | What it is | Time |
|---|---|---|---|
| 1 | [01-CODEBASE-MAP.md](01-CODEBASE-MAP.md) | Where the two workflows live and who calls whom | 15 min |
| 2 | [02-CONCEPTS.md](02-CONCEPTS.md) | Review-workflow and queue concepts, plus the **glossary** | 25 min |
| 3 | [03-WORKED-CHANGE.md](03-WORKED-CHANGE.md) | The change itself, the `claimToken` schema change, three variations to try | 40 min |
| 4 | [04-TESTING-AND-DEBUGGING.md](04-TESTING-AND-DEBUGGING.md) | How the tests are built, and how to tell a real one from a tautology | 30 min |
| 5 | [05-PRACTICE.md](05-PRACTICE.md) | Exercises A–E, including a red-first exercise against the original code | 90 min |
| 6 | [06-SOLUTIONS-AND-REVIEW.md](06-SOLUTIONS-AND-REVIEW.md) | Runnable worked answers, with a review paragraph each | 30 min |
| 7 | [07-TRACE-LAB.md](07-TRACE-LAB.md) | One request through six boundaries, file by file | 45 min |
| 8 | [VERIFICATION.md](VERIFICATION.md) | Setup from a clean checkout, the exact commands, and what the evidence does *not* prove | 20 min |

About four hours end to end. Chapters 1–4 are the reading; 5–7 are the work.

## How to use this course

Begin with the map, then read the concepts chapter (including the glossary and the predict-then-run questions at its end) before opening the changed repositories. Chapter 3 shows the exact predicates that protect a self-review and the claim token that prevents an old worker from completing a newer attempt. Run the focused test command after each exercise.

Before each call you trace, write down the tenant, actor, identifier, expected status, and audit count; then inspect the detached result after it completes. When a fake throws, assert that the state was discarded — and make sure the discarding is done by the fake's `$transaction` helper, not inside the method you are testing. Chapter 4 explains why that distinction is the difference between a test and a tautology.

A useful study session ends with a short written review: name the predicate that prevents a cross-tenant write, the condition that allows only one worker to claim a queue row, and the audit event that must accompany the committed mutation. Then name one limitation that still requires a real database.

## Setup, in one line

`npm ci`, then `npm test -- run`. No database is needed for any test in this course. Full setup — including the optional PostgreSQL container, `db push` and the seed — is in [VERIFICATION.md](VERIFICATION.md).

## Honest limits

The tests use deterministic repository doubles and an in-memory Prisma double. They demonstrate conditional-update contracts and transaction grouping; they do **not** prove PostgreSQL locking, isolation levels or cross-process behaviour. [VERIFICATION.md](VERIFICATION.md) says exactly what is and is not established, and sketches the integration test that would close the gap.

## Original source

Exact pre-change snapshots are in `snapshots/review-repository.ts.original.txt`, `snapshots/integration-repository.ts.original.txt`, `snapshots/review-service.ts.original.txt` and `snapshots/integration-service.ts.original.txt`. Compare them with the changed files before studying the fixes — and use them for the red-first exercise (chapter 5, exercise D). Do not run database push or seed commands against a customer database while following these examples.
