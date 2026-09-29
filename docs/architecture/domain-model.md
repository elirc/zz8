# Domain Model

```mermaid
erDiagram
  Tenant ||--o{ TenantMembership : has
  Tenant ||--o{ OrgUnit : owns
  Tenant ||--o{ Employee : owns
  Tenant ||--o{ ReviewCycle : owns
  Tenant ||--o{ Goal : owns
  Tenant ||--o{ ReviewAssignment : owns
  Tenant ||--o{ ReviewResponse : owns
  Tenant ||--o{ FeedbackRequest : owns
  Tenant ||--o{ CalibrationSession : owns
  Tenant ||--o{ IntegrationConfig : owns
  Tenant ||--o{ MappingRule : owns
  Tenant ||--o{ IntegrationJob : owns
  Tenant ||--o{ IntegrationLog : owns
  Tenant ||--o{ AuditLog : owns

  User ||--o{ TenantMembership : joins
  User ||--o{ ReviewAssignment : reviews
  User ||--o{ FeedbackRequest : sends
  User ||--o{ IntegrationJob : requests

  OrgUnit ||--o{ Employee : groups
  Employee ||--o{ Employee : manages
  Employee ||--o{ Goal : owns
  Employee ||--o{ ReviewAssignment : is_subject

  ReviewCycle ||--o{ Goal : tracks
  ReviewCycle ||--o{ ReviewAssignment : includes
  ReviewAssignment ||--|| ReviewResponse : has
  ReviewCycle ||--o{ FeedbackRequest : requests
  ReviewCycle ||--o{ CalibrationSession : schedules

  IntegrationConfig ||--o{ MappingRule : maps
  IntegrationConfig ||--o{ IntegrationJob : runs
  IntegrationJob ||--o{ IntegrationLog : logs
```

Entity ownership map:

- `Tenant`
  - Schema: `prisma/schema.prisma` model `Tenant`
  - Primary owner: `src/lib/auth/session.ts` because tenant selection is established before any service call
- `User`
  - Schema: `prisma/schema.prisma` model `User`
  - Primary owner: `src/lib/auth/session.ts` because demo auth resolves the active user there
- `TenantMembership`
  - Schema: `prisma/schema.prisma` model `TenantMembership`
  - Primary owner: `src/lib/auth/permissions.ts` because role enforcement depends on membership role
- `OrgUnit`
  - Schema: `prisma/schema.prisma` model `OrgUnit`
  - Primary owner: `src/services/employee-service.ts` in `assertTenantReferences()`
- `Employee`
  - Schema: `prisma/schema.prisma` model `Employee`
  - Primary owner: `src/services/employee-service.ts`
- `ReviewCycle`
  - Schema: `prisma/schema.prisma` model `ReviewCycle`
  - Primary owner: `src/services/review-service.ts`
- `Goal`
  - Schema: `prisma/schema.prisma` model `Goal`
  - Primary owner: `src/repositories/review-repository.ts` in `listCycles()`
- `ReviewAssignment`
  - Schema: `prisma/schema.prisma` model `ReviewAssignment`
  - Primary owner: `src/services/review-service.ts` in `submitSelfReview()`
- `ReviewResponse`
  - Schema: `prisma/schema.prisma` model `ReviewResponse`
  - Primary owner: `src/repositories/review-repository.ts` in `submitSelfReview()`
- `FeedbackRequest`
  - Schema: `prisma/schema.prisma` model `FeedbackRequest`
  - Primary owner: `src/repositories/review-repository.ts` via the cycle count query
- `CalibrationSession`
  - Schema: `prisma/schema.prisma` model `CalibrationSession`
  - Primary owner: `src/repositories/review-repository.ts` indirectly through the review bounded context
- `IntegrationConfig`
  - Schema: `prisma/schema.prisma` model `IntegrationConfig`
  - Primary owner: `src/services/integration-service.ts`
- `MappingRule`
  - Schema: `prisma/schema.prisma` model `MappingRule`
  - Primary owner: `src/repositories/integration-repository.ts`
- `IntegrationJob`
  - Schema: `prisma/schema.prisma` model `IntegrationJob`
  - Primary owner: `src/services/integration-service.ts`
- `IntegrationLog`
  - Schema: `prisma/schema.prisma` model `IntegrationLog`
  - Primary owner: `src/repositories/integration-repository.ts` in `addLog()`
- `AuditLog`
  - Schema: `prisma/schema.prisma` model `AuditLog`
  - Primary owner: `src/repositories/audit-log-repository.ts`
