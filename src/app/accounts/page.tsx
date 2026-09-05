"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Account } from "@/lib/types";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    void fetch("/api/accounts")
      .then((r) => r.json())
      .then((d: { accounts: Account[] }) => setAccounts(d.accounts));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <p className="text-[11px] uppercase tracking-[0.28em] text-muted">
        Stage 3 · account memory
      </p>
      <h1 className="font-serif text-4xl mt-3">Accounts</h1>
      <p className="mt-3 text-muted max-w-2xl">
        Binder will not repeat a pitch that already failed. Each record is what
        a broker should see in the 10 seconds before they dial.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {accounts.map((a) => (
          <Link
            key={a.id}
            href={`/accounts/${a.id}`}
            className="rounded-2xl border border-line p-5 hover:border-amber/40 transition"
          >
            <div className="text-xs text-muted uppercase tracking-[0.18em]">
              {a.industry}
            </div>
            <h2 className="font-serif text-2xl mt-2">{a.name}</h2>
            <dl className="mt-4 grid gap-1 text-sm text-muted">
              <div>Decision maker: {a.decisionMaker ?? "Unknown"}</div>
              <div>Renewal: {a.renewalMonth ?? "Ask — do not guess"}</div>
              <div>Last call: {a.lastCallAt ?? "—"}</div>
              <div>
                Last objection: {a.lastObjection?.replace(/_/g, " ") ?? "—"}
              </div>
              <div>Outcome: {a.lastOutcome?.replace(/_/g, " ") ?? "—"}</div>
            </dl>
          </Link>
        ))}
      </div>
    </div>
  );
}
