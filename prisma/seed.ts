/**
 * What this file does: seeds a realistic demo tenant, users, employees, review data, and integration jobs for local development.
 * What calls it: `npm run db:seed`.
 * What it calls: Prisma client generated from prisma/schema.prisma.
 * One thing a junior engineer would likely get wrong when writing something similar: seeding auth/demo fixtures that do not line up with the ids expected by the UI session adapter.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.integrationLog.deleteMany(),
    prisma.reviewResponse.deleteMany(),
    prisma.reviewAssignment.deleteMany(),
    prisma.feedbackRequest.deleteMany(),
    prisma.goal.deleteMany(),
    prisma.calibrationSession.deleteMany(),
    prisma.integrationJob.deleteMany(),
    prisma.mappingRule.deleteMany(),
    prisma.integrationConfig.deleteMany(),
    prisma.reviewCycle.deleteMany(),
    prisma.tenantMembership.deleteMany(),
    prisma.employee.deleteMany(),
    prisma.orgUnit.deleteMany(),
    prisma.user.deleteMany(),
    prisma.tenant.deleteMany(),
  ]);

  await prisma.tenant.createMany({
    data: [
      {
        id: "tenant_northstar",
        name: "Northstar Health",
        slug: "northstar-health",
      },
      {
        id: "tenant_atlas",
        name: "Atlas Manufacturing",
        slug: "atlas-manufacturing",
      },
    ],
  });

  await prisma.user.createMany({
    data: [
      {
        id: "user_platform_admin",
        email: "platform.admin@example.com",
        displayName: "Platform Admin",
        platformRole: "PLATFORM_ADMIN",
      },
      {
        id: "user_hr_admin",
        email: "alex.hr@northstar.test",
        displayName: "Alex HR",
        platformRole: "NONE",
      },
      {
        id: "user_manager",
        email: "morgan.manager@northstar.test",
        displayName: "Morgan Manager",
        platformRole: "NONE",
      },
      {
        id: "user_employee",
        email: "sam.employee@northstar.test",
        displayName: "Sam Employee",
        platformRole: "NONE",
      },
      {
        id: "user_integration_admin",
        email: "ivy.integrations@northstar.test",
        displayName: "Ivy Integrations",
        platformRole: "NONE",
      },
      {
        id: "user_atlas_hr",
        email: "aria.hr@atlas.test",
        displayName: "Aria Atlas",
        platformRole: "NONE",
      },
    ],
  });

  await prisma.orgUnit.createMany({
    data: [
      {
        id: "org_people",
        tenantId: "tenant_northstar",
        name: "People Operations",
        code: "PEOPLE",
      },
      {
        id: "org_platform",
        tenantId: "tenant_northstar",
        name: "Platform Engineering",
        code: "PLATFORM",
      },
      {
        id: "org_atlas_people",
        tenantId: "tenant_atlas",
        name: "Atlas People",
        code: "ATLAS-PEOPLE",
      },
    ],
  });

  await prisma.employee.createMany({
    data: [
      {
        id: "emp_alex",
        tenantId: "tenant_northstar",
        userId: "user_hr_admin",
        orgUnitId: "org_people",
        employeeNumber: "NS-1001",
        firstName: "Alex",
        lastName: "Harper",
        workEmail: "alex.hr@northstar.test",
        title: "HR Director",
        employmentType: "FULL_TIME",
        status: "ACTIVE",
        compensationCents: 18500000,
        currency: "USD",
        startDate: new Date("2022-02-14"),
      },
      {
        id: "emp_morgan",
        tenantId: "tenant_northstar",
        userId: "user_manager",
        managerId: "emp_alex",
        orgUnitId: "org_platform",
        employeeNumber: "NS-2010",
        firstName: "Morgan",
        lastName: "Lee",
        workEmail: "morgan.manager@northstar.test",
        title: "Engineering Manager",
        employmentType: "FULL_TIME",
        status: "ACTIVE",
        compensationCents: 17200000,
        currency: "USD",
        startDate: new Date("2021-07-05"),
      },
      {
        id: "emp_sam",
        tenantId: "tenant_northstar",
        userId: "user_employee",
        managerId: "emp_morgan",
        orgUnitId: "org_platform",
        employeeNumber: "NS-2011",
        firstName: "Sam",
        lastName: "Patel",
        workEmail: "sam.employee@northstar.test",
        title: "Senior Backend Engineer",
        employmentType: "FULL_TIME",
        status: "ACTIVE",
        compensationCents: 15800000,
        currency: "USD",
        startDate: new Date("2023-04-03"),
      },
      {
        id: "emp_ivy",
        tenantId: "tenant_northstar",
        userId: "user_integration_admin",
        managerId: "emp_alex",
        orgUnitId: "org_people",
        employeeNumber: "NS-1050",
        firstName: "Ivy",
        lastName: "Nguyen",
        workEmail: "ivy.integrations@northstar.test",
        title: "HR Systems Administrator",
        employmentType: "FULL_TIME",
        status: "ACTIVE",
        compensationCents: 14200000,
        currency: "USD",
        startDate: new Date("2022-09-19"),
      },
      {
        id: "emp_atlas_hr",
        tenantId: "tenant_atlas",
        userId: "user_atlas_hr",
        orgUnitId: "org_atlas_people",
        employeeNumber: "AT-1001",
        firstName: "Aria",
        lastName: "Quinn",
        workEmail: "aria.hr@atlas.test",
        title: "People Lead",
        employmentType: "FULL_TIME",
        status: "ACTIVE",
        compensationCents: 14900000,
        currency: "USD",
        startDate: new Date("2020-11-02"),
      },
    ],
  });

  await prisma.tenantMembership.createMany({
    data: [
      {
        id: "membership_platform_admin",
        tenantId: "tenant_northstar",
        userId: "user_platform_admin",
        role: "TENANT_ADMIN",
      },
      {
        id: "membership_hr_admin",
        tenantId: "tenant_northstar",
        userId: "user_hr_admin",
        employeeId: "emp_alex",
        role: "HR_ADMIN",
      },
      {
        id: "membership_manager",
        tenantId: "tenant_northstar",
        userId: "user_manager",
        employeeId: "emp_morgan",
        role: "MANAGER",
      },
      {
        id: "membership_employee",
        tenantId: "tenant_northstar",
        userId: "user_employee",
        employeeId: "emp_sam",
        role: "EMPLOYEE",
      },
      {
        id: "membership_integration_admin",
        tenantId: "tenant_northstar",
        userId: "user_integration_admin",
        employeeId: "emp_ivy",
        role: "INTEGRATION_ADMIN",
      },
      {
        id: "membership_atlas_hr",
        tenantId: "tenant_atlas",
        userId: "user_atlas_hr",
        employeeId: "emp_atlas_hr",
        role: "HR_ADMIN",
      },
    ],
  });

  await prisma.reviewCycle.createMany({
    data: [
      {
        id: "cycle_2026_h1",
        tenantId: "tenant_northstar",
        name: "2026 H1 Performance Cycle",
        description: "Primary performance cycle covering goals, self review, and calibration.",
        startDate: new Date("2026-03-01"),
        endDate: new Date("2026-05-15"),
        status: "ACTIVE",
      },
      {
        id: "cycle_2026_calibration_prep",
        tenantId: "tenant_northstar",
        name: "Calibration Prep Cycle",
        description: "Draft cycle used to test invalid submission transitions.",
        startDate: new Date("2026-06-01"),
        endDate: new Date("2026-07-01"),
        status: "DRAFT",
      },
    ],
  });

  await prisma.goal.createMany({
    data: [
      {
        id: "goal_sam_api",
        tenantId: "tenant_northstar",
        employeeId: "emp_sam",
        reviewCycleId: "cycle_2026_h1",
        title: "Harden tenant-aware API boundaries",
        description: "Move authorization and validation into reusable backend layers.",
        progressPct: 72,
        status: "ACTIVE",
        dueDate: new Date("2026-05-01"),
      },
      {
        id: "goal_morgan_review",
        tenantId: "tenant_northstar",
        employeeId: "emp_morgan",
        reviewCycleId: "cycle_2026_h1",
        title: "Improve manager review quality",
        description: "Standardize expectations and evidence collection for review calibration.",
        progressPct: 55,
        status: "AT_RISK",
        dueDate: new Date("2026-05-10"),
      },
    ],
  });

  await prisma.reviewAssignment.createMany({
    data: [
      {
        id: "assignment_self_sam_h1",
        tenantId: "tenant_northstar",
        reviewCycleId: "cycle_2026_h1",
        subjectEmployeeId: "emp_sam",
        reviewerUserId: "user_employee",
        type: "SELF",
        status: "IN_PROGRESS",
        dueDate: new Date("2026-04-20"),
      },
      {
        id: "assignment_manager_sam_h1",
        tenantId: "tenant_northstar",
        reviewCycleId: "cycle_2026_h1",
        subjectEmployeeId: "emp_sam",
        reviewerUserId: "user_manager",
        type: "MANAGER",
        status: "NOT_STARTED",
        dueDate: new Date("2026-04-28"),
      },
      {
        id: "assignment_self_sam_draft",
        tenantId: "tenant_northstar",
        reviewCycleId: "cycle_2026_calibration_prep",
        subjectEmployeeId: "emp_sam",
        reviewerUserId: "user_employee",
        type: "SELF",
        status: "NOT_STARTED",
        dueDate: new Date("2026-06-15"),
      },
    ],
  });

  await prisma.feedbackRequest.create({
    data: {
      id: "feedback_request_peer",
      tenantId: "tenant_northstar",
      reviewCycleId: "cycle_2026_h1",
      fromUserId: "user_manager",
      toUserId: "user_hr_admin",
      subjectEmployeeId: "emp_sam",
      prompt: "Share examples of Sam's cross-functional delivery during the platform migration.",
      status: "PENDING",
    },
  });

  await prisma.integrationConfig.createMany({
    data: [
      {
        id: "config_workday_export",
        tenantId: "tenant_northstar",
        name: "Workday Employee Export",
        integrationType: "WORKDAY",
        direction: "EXPORT",
        scheduleCron: "0 */4 * * *",
        isActive: true,
      },
      {
        id: "config_greenhouse_import",
        tenantId: "tenant_northstar",
        name: "Greenhouse Candidate Import",
        integrationType: "GREENHOUSE",
        direction: "IMPORT",
        scheduleCron: "15 */6 * * *",
        isActive: true,
      },
    ],
  });

  await prisma.mappingRule.createMany({
    data: [
      {
        id: "mapping_employee_number",
        tenantId: "tenant_northstar",
        integrationConfigId: "config_workday_export",
        sourceField: "employeeNumber",
        targetField: "workerId",
        isRequired: true,
      },
      {
        id: "mapping_manager_email",
        tenantId: "tenant_northstar",
        integrationConfigId: "config_workday_export",
        sourceField: "manager.workEmail",
        targetField: "managerEmail",
        transformStrategy: "LOWERCASE",
        isRequired: false,
      },
    ],
  });

  await prisma.integrationJob.createMany({
    data: [
      {
        id: "job_failed_workday",
        tenantId: "tenant_northstar",
        integrationConfigId: "config_workday_export",
        requestedByUserId: "user_integration_admin",
        status: "FAILED",
        payloadJson: {
          source: "manual-admin-trigger",
          simulateFailure: true,
        },
        errorMessage: "Vendor 502 while exporting employee payload.",
        retryReason: "Previous retry still hit downstream outage.",
        attemptCount: 2,
        startedAt: new Date("2026-04-06T11:00:00Z"),
        finishedAt: new Date("2026-04-06T11:04:00Z"),
      },
      {
        id: "job_queued_greenhouse",
        tenantId: "tenant_northstar",
        integrationConfigId: "config_greenhouse_import",
        requestedByUserId: "user_integration_admin",
        status: "QUEUED",
        payloadJson: {
          source: "scheduled-cron",
          simulateFailure: false,
        },
        attemptCount: 0,
      },
    ],
  });

  await prisma.integrationLog.createMany({
    data: [
      {
        id: "log_failed_workday_error",
        tenantId: "tenant_northstar",
        integrationJobId: "job_failed_workday",
        level: "ERROR",
        message: "Downstream vendor returned HTTP 502.",
      },
      {
        id: "log_failed_workday_retry",
        tenantId: "tenant_northstar",
        integrationJobId: "job_failed_workday",
        level: "INFO",
        message: "Operator queued a retry after verifying mappings.",
      },
    ],
  });

  console.log("Seeded People Control Center demo data.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
