import Link from "next/link";

import { AppShell } from "@/components/shell/app-shell";

const sections = [
  {
    href: "/employees",
    title: "Multi-Tenant HRIS Core",
    description:
      "Employee records, managers, org structure, statuses, and compensation fields with explicit tenant-aware authorization.",
    glyph: "HR",
  },
  {
    href: "/reviews",
    title: "Performance Review Platform",
    description:
      "Review cycles, goals, self reviews, workflow status checks, and calibration-ready lifecycle controls.",
    glyph: "RV",
  },
  {
    href: "/integrations",
    title: "Integration Hub Admin",
    description:
      "Integration configs, queued and failed jobs, retry flows, logs, and an operator-controlled processing path.",
    glyph: "OP",
  },
];

export default function Home() {
  return (
    <AppShell eyebrow="Unified Platform" title="A production-style HR operations control plane">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-[1.75rem] border border-stone-200 bg-stone-50/80 p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-teal-700">
            Why this architecture
          </p>
          <h3 className="mt-3 max-w-2xl text-3xl leading-tight text-stone-950">
            The product combines relational HR data, review workflows, and support-facing async tooling without collapsing the logic into UI code.
          </h3>
          <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600">
            Multi-tenancy is first-class because the requirements explicitly call for a multi-tenant HRIS core. Prisma was chosen over Drizzle because the domain is relationship-heavy and the learning goal benefits from Prisma&apos;s readable model-to-service path. REST is the best fit here because the platform spans user CRUD, operational actions, and worker-like endpoints that are easy to trace as concrete HTTP surfaces.
          </p>
        </article>

        <article className="rounded-[1.75rem] border border-stone-200 bg-stone-900 p-6 text-stone-100">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-300">
            Major decisions
          </p>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-stone-300">
            <li>Tenant boundaries are enforced in repositories, not inferred in the UI.</li>
            <li>Authorization is centralized in service guards, not scattered across pages.</li>
            <li>Validation happens with Zod at the route boundary before business logic runs.</li>
            <li>Workflow transitions are explicit and reject invalid source states.</li>
            <li>Operational job processing has its own job module instead of living inside a handler.</li>
          </ul>
        </article>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group rounded-[1.75rem] border border-stone-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-sm font-semibold text-teal-700">
                {section.glyph}
              </div>
              <span className="text-sm font-semibold text-stone-400 transition group-hover:text-stone-900">
                Open
              </span>
            </div>

            <h3 className="mt-6 text-xl font-semibold text-stone-950">{section.title}</h3>
            <p className="mt-3 text-sm leading-6 text-stone-600">{section.description}</p>
          </Link>
        ))}
      </section>
    </AppShell>
  );
}
