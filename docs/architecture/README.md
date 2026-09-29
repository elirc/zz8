# Architecture

Unison HR combines three product areas in one tenant-aware Next.js application: HRIS core data, performance review workflows, and integration operations. The app layer lives in `src/app/`, the business layer lives in `src/services/`, the database access layer lives in `src/repositories/`, and shared cross-cutting infrastructure lives in `src/lib/`.

Top-level folders and how they relate:

- `prisma/`
  - `prisma/schema.prisma` defines the tenant-owned relational model.
  - `prisma/seed.ts` seeds demo tenants, users, employees, cycles, and jobs that match the demo session headers.
- `src/app/`
  - `src/app/api/employees/route.ts` and `src/app/api/review-cycles/route.ts` are thin HTTP entrypoints.
  - `src/app/employees/page.tsx`, `src/app/reviews/page.tsx`, and `src/app/integrations/page.tsx` compose UI pages from feature panels.
- `src/services/`
  - `src/services/employee-service.ts`, `src/services/review-service.ts`, and `src/services/integration-service.ts` own business rules.
  - `src/services/service-factory.ts` wires Prisma-backed repositories into concrete service instances.
- `src/repositories/`
  - `src/repositories/employee-repository.ts`, `src/repositories/review-repository.ts`, and `src/repositories/integration-repository.ts` issue tenant-scoped Prisma queries.
  - `src/repositories/repository-context.ts` carries `tenantId` and `actorUserId` from the session into repository calls.
- `src/lib/`
  - `src/lib/auth/session.ts` resolves the acting session from demo headers.
  - `src/lib/auth/permissions.ts` centralizes tenant and platform role checks.
  - `src/lib/validation/*.ts` define Zod request boundaries.
  - `src/lib/db.ts` creates the Prisma client with the PostgreSQL adapter.
- `src/components/` and `src/hooks/`
  - `src/components/employees/employee-directory.tsx` stays UI-focused and delegates network state to `src/hooks/useEmployees.ts`.
  - `src/components/providers/demo-session-provider.tsx` keeps the demo role-switching state outside feature panels.
- `src/jobs/`
  - `src/jobs/processIntegrationJobs.ts` and `src/jobs/process-queued-integration-jobs.ts` isolate worker-style queue processing from the route handlers.

This project intentionally keeps validation, authorization, workflow rules, and persistence in separate files so a reviewer can trace a request from page to route to service to repository without business logic disappearing into React components.
