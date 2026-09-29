/**
 * What this file does: centralizes shared domain enums and lightweight request/session types used across the app.
 * What calls it: auth utilities, validation schemas, repositories, services, and UI hooks.
 * What it calls: no runtime dependencies besides TypeScript itself.
 * One thing a junior engineer would likely get wrong when writing something similar: duplicating role and status strings in many files until they quietly drift apart.
 */
export const PLATFORM_ROLES = ["PLATFORM_ADMIN", "PLATFORM_SUPPORT", "NONE"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const TENANT_ROLES = [
  "TENANT_ADMIN",
  "HR_ADMIN",
  "MANAGER",
  "EMPLOYEE",
  "INTEGRATION_ADMIN",
] as const;
export type TenantRole = (typeof TENANT_ROLES)[number];

export const EMPLOYMENT_STATUSES = [
  "ONBOARDING",
  "ACTIVE",
  "LEAVE",
  "TERMINATED",
] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

export const REVIEW_CYCLE_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "CALIBRATING",
  "COMPLETED",
] as const;
export type ReviewCycleStatus = (typeof REVIEW_CYCLE_STATUSES)[number];

export const REVIEW_ASSIGNMENT_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "SUBMITTED",
  "APPROVED",
] as const;
export type ReviewAssignmentStatus = (typeof REVIEW_ASSIGNMENT_STATUSES)[number];

export const INTEGRATION_JOB_STATUSES = [
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "RETRY_REQUIRED",
  "CANCELLED",
] as const;
export type IntegrationJobStatus = (typeof INTEGRATION_JOB_STATUSES)[number];

export const INTEGRATION_TYPES = [
  "WORKDAY",
  "GREENHOUSE",
  "OKTA",
  "BENEFITS_VENDOR",
] as const;
export type IntegrationType = (typeof INTEGRATION_TYPES)[number];

export const INTEGRATION_DIRECTIONS = [
  "IMPORT",
  "EXPORT",
  "BIDIRECTIONAL",
] as const;
export type IntegrationDirection = (typeof INTEGRATION_DIRECTIONS)[number];

export const AUDIT_ACTIONS = [
  "EMPLOYEE_CREATED",
  "EMPLOYEE_UPDATED",
  "REVIEW_SUBMITTED",
  "INTEGRATION_JOB_RETRIED",
  "INTEGRATION_JOB_PROCESSED",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AppSession {
  userId: string;
  activeTenantId: string;
  platformRole: PlatformRole;
  tenantRole: TenantRole;
  employeeId?: string;
  displayName: string;
}
