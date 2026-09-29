"use client";

/**
 * What this file does: renders the shared navigation, page chrome, and demo-session selector for the product areas.
 * What calls it: route pages under src/app/.
 * What it calls: Next.js navigation helpers, the demo-session provider, and the shared `cn` utility.
 * One thing a junior engineer would likely get wrong when writing something similar: showing a role badge in the shell but not wiring that same state into the API request path.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useDemoSession } from "@/components/providers/demo-session-provider";
import { cn } from "@/lib/cn";

const navItems = [
  { href: "/", label: "Overview", glyph: "01" },
  { href: "/employees", label: "HRIS Core", glyph: "02" },
  { href: "/reviews", label: "Review Cycles", glyph: "03" },
  { href: "/integrations", label: "Integration Ops", glyph: "04" },
];

export function AppShell({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { activeSessionId, setActiveSessionId, options, displayName, tenantRole } =
    useDemoSession();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(224,145,74,0.18),_transparent_36%),radial-gradient(circle_at_top_right,_rgba(44,107,97,0.18),_transparent_30%),linear-gradient(180deg,_#f7f2e8_0%,_#f2eee6_100%)] text-stone-900">
      <div className="mx-auto flex min-h-screen max-w-7xl gap-6 px-4 py-6 md:px-8">
        <aside className="hidden w-80 shrink-0 rounded-[2rem] border border-stone-200/80 bg-white/85 p-6 shadow-[0_30px_80px_rgba(96,69,33,0.12)] backdrop-blur md:block">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
              People Control Center
            </p>
            <h1 className="text-2xl leading-tight text-stone-900">
              One control plane for HR data, review workflows, and integration support.
            </h1>
          </div>

          <nav className="mt-10 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                  pathname === item.href
                    ? "bg-stone-900 text-white"
                    : "text-stone-700 hover:bg-stone-100 hover:text-stone-950",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold",
                    pathname === item.href
                      ? "bg-white/12 text-white"
                      : "bg-teal-50 text-teal-700",
                  )}
                >
                  {item.glyph}
                </span>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-10 rounded-2xl bg-stone-900 px-4 py-4 text-stone-100">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">
              Active demo session
            </p>
            <p className="mt-2 text-sm font-semibold">{displayName}</p>
            <p className="mt-1 text-xs text-stone-300">{tenantRole}</p>
            <select
              className="mt-4 w-full rounded-2xl border border-white/10 bg-white/8 px-3 py-3 text-sm outline-none"
              value={activeSessionId}
              onChange={(event) => setActiveSessionId(event.target.value)}
            >
              {options.map((option) => (
                <option key={option.sessionId} value={option.sessionId}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </aside>

        <main className="flex-1 rounded-[2rem] border border-stone-200/70 bg-white/80 p-6 shadow-[0_30px_80px_rgba(96,69,33,0.08)] backdrop-blur md:p-8">
          <div className="mb-8 flex flex-col gap-4 border-b border-stone-200/80 pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-700">
                {eyebrow}
              </p>
              <h2 className="mt-3 text-4xl leading-tight text-stone-950">{title}</h2>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
              Frontend session selection changes the actual API headers, so auth and tenant behavior stay testable.
            </div>
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
