# Testing Rationale

## `src/tests/auth-permissions.test.ts` — `POST /api/employees` rejects an `EMPLOYEE` actor
Why this matters in production: HR write endpoints are high-risk because a missing role gate turns into unauthorized employee data mutation very quickly.
What bug this catches: route-level auth drift where the UI blocks an action but the API still accepts it.
What a fuller suite would add: coverage for `TENANT_ADMIN`, `HR_ADMIN`, and `MANAGER` variations plus platform-role behavior on ops endpoints.

## `src/tests/validation-boundaries.test.ts` — `createEmployeeSchema` rejects malformed input
Why this matters in production: malformed payloads should fail at the boundary instead of producing partial writes or obscure downstream errors.
What bug this catches: weak input validation around emails, dates, and compensation fields.
What a fuller suite would add: table-driven cases for each employee field and explicit assertions on the returned validation shape.

## `src/tests/review-transition.test.ts` — `ReviewService.submitSelfReview()` rejects an already submitted assignment
Why this matters in production: workflow bugs corrupt trust faster than CRUD bugs because they silently violate process rules.
What bug this catches: duplicate or illegal review submissions after a status transition has already happened.
What a fuller suite would add: happy-path submission, inactive-cycle rejection, wrong-reviewer rejection, and persistence assertions around the response transaction.

## `src/tests/tenant-isolation.test.ts` — tenant-scoped employee reads do not return another tenant's record
Why this matters in production: cross-tenant leaks are among the most severe classes of bugs in a multi-tenant HR system.
What bug this catches: missing tenant filters on owner-scoped reads.
What a fuller suite would add: repository-level integration tests against a seeded database plus write-path isolation tests for updates and deletes.
