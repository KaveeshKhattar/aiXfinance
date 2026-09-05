"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Live" },
  { href: "/accounts", label: "Accounts" },
  { href: "/debriefs", label: "Debriefs" },
  { href: "/intelligence", label: "Intelligence" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const live = path === "/";

  return (
    <div className="min-h-full flex flex-col">
      <header
        className={`flex items-center justify-between px-6 py-4 border-b border-line ${live ? "opacity-70" : ""}`}
      >
        <Link href="/" className="flex items-baseline gap-3">
          <span className="font-serif text-2xl tracking-tight">Binder</span>
          <span className="text-[11px] uppercase tracking-[0.22em] text-muted">
            Sales coach
          </span>
        </Link>
        <nav className="flex gap-1 text-sm">
          {LINKS.map((l) => {
            const on = path === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-full ${
                  on
                    ? "bg-fg/8 text-fg"
                    : "text-muted hover:text-fg"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
