"use client";

import { useEffect, useState } from "react";
import type { BrokerProfile, InsightPack } from "@/lib/types";

export default function IntelligencePage() {
  const [pack, setPack] = useState<InsightPack | null>(null);
  const [brokers, setBrokers] = useState<BrokerProfile[]>([]);

  useEffect(() => {
    void fetch("/api/insights")
      .then((r) => r.json())
      .then((d: { insights: InsightPack; brokers: BrokerProfile[] }) => {
        setPack(d.insights);
        setBrokers(d.brokers);
      });
  }, []);

  if (!pack) {
    return <div className="px-6 py-16 text-muted">Computing…</div>;
  }

  const maxFunnel = Math.max(...pack.funnel.map((f) => f.count), 1);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <p className="text-[11px] uppercase tracking-[0.28em] text-muted">
        Stage 4 · intelligence
      </p>
      <h1 className="font-serif text-4xl mt-3">What the team is teaching Binder</h1>
      <p className="mt-3 text-muted max-w-2xl text-sm">{pack.dataNote}</p>

      <section className="mt-12 grid gap-4">
        {pack.team.map((line) => (
          <p
            key={line}
            className="font-serif text-2xl sm:text-3xl leading-snug border-l border-amber/50 pl-5"
          >
            {line}
          </p>
        ))}
      </section>

      <h2 className="mt-16 text-[11px] uppercase tracking-[0.22em] text-muted">
        Opener A/B
      </h2>
      <div className="mt-4 grid sm:grid-cols-3 gap-3">
        {pack.openers.map((o) => (
          <div key={o.variant} className="rounded-2xl border border-line p-4">
            <div className="text-sm">{o.variant}</div>
            <div className="font-serif text-4xl mt-2 text-amber">
              {o.meetingRate}%
            </div>
            <div className="text-xs text-muted mt-1">
              meeting rate · {o.discoveryRate}% discovery · n={o.n}
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-16 text-[11px] uppercase tracking-[0.22em] text-muted">
        Funnel
      </h2>
      <div className="mt-4 space-y-2">
        {pack.funnel.map((f) => (
          <div key={f.stage} className="flex items-center gap-3">
            <span className="w-28 text-xs uppercase tracking-wider text-muted">
              {f.stage}
            </span>
            <div className="flex-1 h-2 rounded-full bg-fg/8">
              <div
                className="h-2 rounded-full bg-amber"
                style={{ width: `${(f.count / maxFunnel) * 100}%` }}
              />
            </div>
            <span className="w-8 text-xs text-muted">{f.count}</span>
          </div>
        ))}
      </div>

      <h2 className="mt-16 text-[11px] uppercase tracking-[0.22em] text-muted">
        Objections
      </h2>
      <div className="mt-4 grid gap-3">
        {pack.objections.map((o) => (
          <div key={o.code} className="rounded-2xl border border-line p-4">
            <div className="flex justify-between text-sm">
              <span>{o.code.replace(/_/g, " ")}</span>
              <span className="text-amber">{o.convertRate}% convert · n={o.n}</span>
            </div>
            <p className="text-sm text-muted mt-2">{o.tip}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-16 text-[11px] uppercase tracking-[0.22em] text-muted">
        Segments
      </h2>
      <div className="mt-4 grid sm:grid-cols-3 gap-3">
        {pack.segments.map((s) => (
          <div key={s.industry} className="rounded-2xl border border-line p-4">
            <div className="text-sm">{s.industry}</div>
            <div className="font-serif text-3xl mt-1">{s.meetingRate}%</div>
            <div className="text-xs text-muted">meetings · n={s.n}</div>
          </div>
        ))}
      </div>

      <h2 className="mt-16 text-[11px] uppercase tracking-[0.22em] text-muted">
        Individual coaching
      </h2>
      <div className="mt-4 grid gap-4">
        {pack.brokers.map((b) => {
          const profile = brokers.find((p) => p.id === b.brokerId);
          return (
            <div key={b.brokerId} className="rounded-2xl border border-line p-5">
              <div className="font-serif text-2xl">{b.name}</div>
              {profile && (
                <p className="text-xs text-muted mt-1">
                  {profile.strength} · watch: {profile.weakness}
                </p>
              )}
              <ul className="mt-3 space-y-1 text-sm text-muted">
                {b.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
