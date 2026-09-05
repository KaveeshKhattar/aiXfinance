"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { parseTranscript } from "@/lib/parse-transcript";
import type { CallRecord, Debrief } from "@/lib/types";

const SAMPLE = `Broker: Hi, I'm calling from ABC Insurance...
Gatekeeper: What is this regarding?
Broker: We're an insurance brokerage...
Gatekeeper: Just send an email.`;

export default function DebriefsPage() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [raw, setRaw] = useState(SAMPLE);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Debrief | null>(null);
  const [nextLine, setNextLine] = useState<string | null>(null);
  const [who, setWho] = useState<string | null>(null);

  const load = () =>
    fetch("/api/calls")
      .then((r) => r.json())
      .then((d: { calls: CallRecord[] }) => setCalls(d.calls));

  useEffect(() => {
    void load();
  }, []);

  const analyze = async () => {
    setBusy(true);
    const turns = parseTranscript(raw);
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        turns,
        accountId: "harbor",
        brokerId: "jordan",
        synthetic: true,
      }),
    });
    const data = (await res.json()) as {
      debrief: Debrief;
      nextLine: string;
      state: { speaker: string; stage: string; objection: string };
    };
    setResult(data.debrief);
    setNextLine(data.nextLine);
    setWho(
      `${data.state.speaker.replace(/_/g, " ")} · ${data.state.stage} · ${data.state.objection.replace(/_/g, " ")}`,
    );
    setBusy(false);
    void load();
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-[11px] uppercase tracking-[0.28em] text-muted">
        Stage 1 · analysis
      </p>
      <h1 className="font-serif text-4xl mt-3">Debriefs</h1>
      <p className="mt-3 text-muted text-sm max-w-2xl">
        Paste a transcript. Binder answers: who am I talking to, what is
        happening, what should I say next.
      </p>

      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        className="mt-6 w-full min-h-40 rounded-2xl border border-line bg-transparent p-4 text-sm outline-none focus:border-amber/50"
      />
      <button
        onClick={() => void analyze()}
        disabled={busy}
        className="mt-3 rounded-full bg-fg text-bg px-5 py-2 text-sm"
      >
        {busy ? "Analyzing…" : "Analyze transcript"}
      </button>

      {result && (
        <div className="mt-8 rounded-2xl border border-amber/30 p-5 space-y-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted">
            Who · what&apos;s happening
          </p>
          <p className="text-lg">{who}</p>
          <p className="font-serif text-2xl leading-snug">{nextLine}</p>
          <p className="text-muted text-sm">{result.whatHappened}</p>
          <p className="text-muted text-sm">
            Outcome: {result.outcome.replace(/_/g, " ")}
          </p>
        </div>
      )}

      <ul className="mt-10 space-y-3">
        {calls.map((c) => (
          <li key={c.id}>
            <Link
              href={`/debriefs/${c.id}`}
              className="block rounded-2xl border border-line px-5 py-4 hover:border-amber/40"
            >
              <div className="flex justify-between gap-4">
                <span className="font-medium">{c.accountId}</span>
                <span className="text-sm text-muted">
                  {c.outcome.replace(/_/g, " ")}
                </span>
              </div>
              <p className="text-xs text-muted mt-1">
                {c.startedAt.slice(0, 10)} · {c.stageReached} · broker {c.brokerId}
                {c.synthetic ? " · synthetic" : ""}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
