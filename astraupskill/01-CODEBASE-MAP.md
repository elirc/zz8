# 1. Codebase map

*Time: about 15 minutes. Unfamiliar word? The glossary is at the end of [chapter 2](02-CONCEPTS.md).*



The route `src/app/api/review-cycles/[cycleId]/submit-self-review/route.ts` parses the request and obtains the authenticated employee context. It calls `reviewCycleService`, wired by `src/services/service-factory.ts`. `ReviewService.submitSelfReview` checks role, employee identity, cycle state, and assignment state before passing a small command to `ReviewRepository`.



The repository is the persistence boundary. `findSelfReviewContext` reads only the tenant, cycle, reviewer, subject, and SELF assignment. `submitSelfReview` runs inside `db.$transaction`, conditionally changes an available assignment, creates the response, and writes the audit row. The transaction callback is the important unit: the response and audit cannot outlive a failed assignment claim.



The integration path begins at `src/app/api/integration-jobs/process/route.ts`, passes through `IntegrationService.processQueuedJobs`, and reaches `processQueuedIntegrationJobs`. `IntegrationRepository.claimQueuedJobs` selects a bounded batch, then uses a QUEUED predicate to claim each row, increments attempts, and assigns an immutable token. The worker passes that token to `completeJob`; a stale worker receives zero rows and cannot overwrite a later attempt.



When tracing a defect, write down actor, tenant, entity ID, current status, expected status, and side effects. This prevents a route-level symptom from hiding a repository predicate bug.


## Reading path

The review route resolves the authenticated actor and tenant before it calls the service. The service passes reviewer, subject, cycle, and review type into the repository, where every predicate is evaluated inside the transaction. The integration worker follows a separate path: it claims only queued rows, receives a unique claim token, performs the external work, and completes only when the token still matches. Read the contracts first, then compare the mock and Prisma repositories line by line. The important boundary is not the shape of the returned object; it is which rows can be changed and which audit records can be committed together.

## Two naming conventions, one service

The first thing that confuses a new reader: there are two files per service. `src/services/review-service.ts` (kebab-case) holds the `ReviewService` **class** — that is the file this course changes. `src/services/reviewCycleService.ts` (camelCase) is a one-line singleton: `export const reviewCycleService = createReviewService()`, built by `src/services/service-factory.ts`. The camelCase file is what route handlers import, so that every request shares one instance; the kebab-case file is what tests import, so that they can pass their own repositories to the constructor. Neither is dead code.

The same split does not exist for repositories: `src/repositories/review-repository.ts` and `integration-repository.ts` are the only implementations, and they talk to Prisma through the shared client in `src/lib/db.ts`.

## What to ignore

`src/app/employees`, `src/components/employees`, `src/hooks/useEmployees.ts` and everything under `src/app/api/employees` belong to a different feature of the same application. They are worth a glance for shape, but no chapter here depends on them.
