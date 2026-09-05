"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { coachTurn } from "@/lib/coach-engine";
import { detectSpeaker } from "@/lib/detect";
import { SCENARIOS } from "@/lib/seed";
import { ACCOUNTS, BROKERS } from "@/lib/seed";
import type {
  Account,
  BrokerProfile,
  ConversationState,
  Debrief,
  SpeakerRole,
  Turn,
} from "@/lib/types";

type Mode = "idle" | "live" | "mic" | "done";

const MOMENTUM: Record<string, string> = {
  cold: "bg-[#c45c4a]",
  neutral: "bg-fg/25",
  warming: "bg-amber",
  hot: "bg-live",
};

export function LiveCoach() {
  const [mode, setMode] = useState<Mode>("idle");
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [brokerId, setBrokerId] = useState("priya");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [state, setState] = useState<ConversationState | null>(null);
  const [accountHint, setAccountHint] = useState<string | null>(null);
  const [audioStatus, setAudioStatus] = useState<string | null>(null);
  const [debrief, setDebrief] = useState<Debrief | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognition | null>(null);
  const micNextSpeaker = useRef<SpeakerRole>("broker");
  const sessionId = useRef(`binder-${Date.now()}`);
  const timers = useRef<number[]>([]);

  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;
  const account: Account | undefined = ACCOUNTS.find(
    (a) => a.id === (mode === "mic" ? "northwind" : scenario.accountId),
  );
  const broker: BrokerProfile | undefined = BROKERS.find((b) => b.id === brokerId);

  const applyTurns = useCallback(
    (next: Turn[], acc = account, br = broker) => {
      setTurns(next);
      const local = coachTurn(next, acc, br);
      setState(local);
      if (acc) {
        setAccountHint(
          `${acc.name} · ${acc.decisionMaker ?? "DM unknown"} · renews ${acc.renewalMonth ?? "?"} · last: ${acc.lastObjection?.replace(/_/g, " ") ?? "none"}`,
        );
      }
      void fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: acc?.id,
          brokerId: br?.id,
          sessionId: sessionId.current,
          turns: next,
        }),
      })
        .then((r) => r.json())
        .then(
          (
            remote: ConversationState & {
              accountHint?: string;
              coachSource?: "local_playbook" | "llm_polished";
              latencyMs?: number;
              prismConnected?: boolean;
            },
          ) => {
          setState(remote);
          if (remote.accountHint) setAccountHint(remote.accountHint);
          if (remote.latencyMs !== undefined) {
            const source =
              remote.coachSource === "llm_polished" ? "LLM polished" : "local playbook";
            const prism = remote.prismConnected ? " · PRISM trace" : "";
            setAudioStatus(`${source} · ${remote.latencyMs}ms${prism}`);
          }
        },
        )
        .catch(() => undefined);
    },
    [account, broker],
  );

  const stopAll = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    window.speechSynthesis?.cancel();
    recRef.current?.stop();
    recRef.current = null;
  }, []);

  const speakTurn = (turn: Turn) => {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setAudioStatus("Replay audio unavailable in this browser.");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(turn.text);
    utterance.lang = "en-US";
    utterance.rate = turn.speaker === "broker" ? 1.02 : 0.94;
    utterance.pitch =
      turn.speaker === "broker"
        ? 1.1
        : turn.speaker === "decision_maker"
          ? 0.88
          : 0.96;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
    setAudioStatus("Replay audio on");
  };

  const finish = useCallback(
    async (finalTurns: Turn[], accId: string, brId: string, synthetic: boolean) => {
      stopAll();
      setMode("done");
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: accId,
          brokerId: brId,
          sessionId: sessionId.current,
          turns: finalTurns,
          openerVariant: "B",
          synthetic,
        }),
      });
      const data = (await res.json()) as { debrief: Debrief; call: { id: string } };
      setDebrief(data.debrief);
      setCallId(data.call.id);
    },
    [stopAll],
  );

  const startReplay = () => {
    stopAll();
    setDebrief(null);
    setCallId(null);
    setTurns([]);
    setState(null);
    setAudioStatus(null);
    sessionId.current = `binder-replay-${scenario.id}-${Date.now()}`;
    setMode("live");
    const acc = ACCOUNTS.find((a) => a.id === scenario.accountId);
    const br = BROKERS.find((b) => b.id === brokerId) ?? BROKERS.find((b) => b.id === scenario.brokerId);
    const replay: Turn[] = [];
    scenario.turns.forEach((turn, i) => {
      const id = window.setTimeout(() => {
        replay.push(turn);
        speakTurn(turn);
        applyTurns([...replay], acc, br);
        if (i === scenario.turns.length - 1) {
          const end = window.setTimeout(() => {
            void finish([...replay], scenario.accountId, br?.id ?? brokerId, true);
          }, 2600);
          timers.current.push(end);
        }
      }, (turn.atMs || i * 3500) + 400);
      timers.current.push(id);
    });
  };

  const startMic = () => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      setAccountHint("This browser has no speech recognition. Use a replay scenario.");
      return;
    }
    stopAll();
    setDebrief(null);
    setTurns([]);
    setState(null);
    setAudioStatus("Microphone listening");
    setMode("mic");
    sessionId.current = `binder-mic-${Date.now()}`;
    micNextSpeaker.current = "broker";
    const acc = ACCOUNTS.find((a) => a.id === "harbor");
    const br = BROKERS.find((b) => b.id === brokerId);
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (ev) => {
      let text = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) text += ev.results[i][0].transcript;
      }
      text = text.trim();
      if (!text) return;
      const expected = micNextSpeaker.current;
      const speaker =
        expected === "broker"
          ? detectSpeaker(text, "broker")
          : detectSpeaker(text, "decision_maker");
      micNextSpeaker.current = speaker === "broker" ? "decision_maker" : "broker";
      setAudioStatus(
        speaker === "broker"
          ? "Heard broker. Waiting for prospect..."
          : `Heard ${speaker.replace(/_/g, " ")}. Coaching next line...`,
      );
      setTurns((prev) => {
        const next: Turn[] = [
          ...prev,
          { speaker, text, atMs: Date.now() },
        ];
        applyTurns(next, acc, br);
        return next;
      });
    };
    rec.onend = () => {
      if (recRef.current) {
        try {
          rec.start();
        } catch {
          /* already started */
        }
      }
    };
    rec.start();
    recRef.current = rec;
  };

  const hangupMic = () => {
    const acc = ACCOUNTS.find((a) => a.id === "harbor");
    void finish(turns, acc?.id ?? "harbor", brokerId, false);
  };

  useEffect(() => () => stopAll(), [stopAll]);

  const whisper = state?.intervention ? state.whisper : null;
  const live = mode === "live" || mode === "mic";

  return (
    <div className="relative min-h-[calc(100vh-73px)] flex flex-col">
      {mode === "idle" && (
        <div className="mx-auto w-full max-w-3xl px-6 py-16">
          <p className="text-[11px] uppercase tracking-[0.28em] text-muted">
            Stage 2 · whisper coach
          </p>
          <h1 className="font-serif text-5xl sm:text-6xl mt-4 leading-[1.05]">
            One line.
            <br />
            Then silence.
          </h1>
          <p className="mt-5 max-w-xl text-muted text-base leading-relaxed">
            Binder listens to a cold call, decides if you need help, and
            whispers a sentence you can say out loud. It will not invent
            coverage, prices, or the prospect&apos;s policy.
          </p>
          <p className="mt-3 text-xs text-muted/80">
            Replays use synthetic insurance roleplays. Say that in the demo.
          </p>

          <div className="mt-10 grid gap-3">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setScenarioId(s.id);
                  setBrokerId(s.brokerId);
                }}
                className={`text-left rounded-2xl border px-4 py-3 transition ${
                  scenarioId === s.id
                    ? "border-amber/50 bg-amber/8"
                    : "border-line hover:border-fg/20"
                }`}
              >
                <div className="text-sm">{s.title}</div>
                <div className="text-xs text-muted mt-1">{s.subtitle}</div>
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {BROKERS.map((b) => (
              <button
                key={b.id}
                onClick={() => setBrokerId(b.id)}
                className={`text-xs rounded-full px-3 py-1.5 border ${
                  brokerId === b.id
                    ? "border-amber text-amber"
                    : "border-line text-muted"
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={startReplay}
              className="rounded-full bg-fg text-bg px-5 py-2.5 text-sm font-medium"
            >
              Replay call
            </button>
            <button
              onClick={startMic}
              className="rounded-full border border-line px-5 py-2.5 text-sm"
            >
              Use microphone
            </button>
          </div>
        </div>
      )}

      {live && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-28">
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-muted">
            <span className="live-dot inline-block h-2 w-2 rounded-full bg-live" />
            Live
            <span className="text-fg/40">·</span>
            <span>{state?.stage ?? "intro"}</span>
            <span className="text-fg/40">·</span>
            <span>{(state?.speaker ?? "unknown").replace(/_/g, " ")}</span>
          </div>

          <div
            className={`mt-4 h-1 w-24 rounded-full ${MOMENTUM[state?.momentum ?? "neutral"]}`}
          />

          <div className="mt-16 max-w-3xl text-center min-h-[8rem]">
            {whisper ? (
              <p
                key={whisper}
                className="whisper-in font-serif text-3xl sm:text-5xl leading-tight text-fg"
              >
                {whisper}
              </p>
            ) : (
              <p className="font-serif text-3xl sm:text-5xl text-muted/40">
                {live ? "·" : ""}
              </p>
            )}
          </div>

          {!whisper && (
            <p className="mt-6 text-[11px] uppercase tracking-[0.3em] text-muted">
              Silent
            </p>
          )}

          {accountHint && (
            <p className="mt-10 text-xs text-muted max-w-xl text-center">
              {accountHint}
            </p>
          )}

          {audioStatus && (
            <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-muted">
              {audioStatus}
            </p>
          )}

          {mode === "mic" && (
            <button
              onClick={hangupMic}
              className="mt-10 text-xs uppercase tracking-[0.2em] text-muted hover:text-fg"
            >
              End call
            </button>
          )}
        </div>
      )}

      {mode === "done" && debrief && (
        <div className="mx-auto w-full max-w-3xl px-6 py-14">
          <p className="text-[11px] uppercase tracking-[0.28em] text-muted">
            Stage 1 · post-call
          </p>
          <h2 className="font-serif text-4xl mt-3">Debrief</h2>
          <dl className="mt-8 grid gap-6">
            <Item label="What happened" value={debrief.whatHappened} />
            <Item label="Outcome" value={debrief.outcome.replace(/_/g, " ")} />
            <Item label="Worked" value={debrief.whatWorked} />
            <Item label="Didn't" value={debrief.whatDidnt} />
            <Item label="One thing" value={debrief.oneThingToImprove} />
          </dl>
          <div className="mt-10 rounded-2xl border border-line p-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted">
              CRM writeback
            </p>
            <pre className="mt-3 text-xs text-muted whitespace-pre-wrap font-mono">
              {JSON.stringify(debrief.crm, null, 2)}
            </pre>
          </div>
          <div className="mt-8 flex gap-3">
            <button
              onClick={() => {
                setMode("idle");
                setDebrief(null);
              }}
              className="rounded-full bg-fg text-bg px-5 py-2.5 text-sm"
            >
              New call
            </button>
            {callId && (
              <a
                href={`/debriefs/${callId}`}
                className="rounded-full border border-line px-5 py-2.5 text-sm"
              >
                Open record
              </a>
            )}
          </div>
        </div>
      )}

      {live && turns.length > 0 && (
        <div className="pointer-events-none absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-bg to-transparent">
          <div className="max-w-3xl mx-auto space-y-1 opacity-40">
            {turns.slice(-3).map((t, i) => (
              <p key={`${t.atMs}-${i}`} className="text-xs truncate">
                <span className="uppercase tracking-wider mr-2">
                  {t.speaker.replace(/_/g, " ")}
                </span>
                {t.text}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.22em] text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-lg leading-snug">{value}</dd>
    </div>
  );
}
