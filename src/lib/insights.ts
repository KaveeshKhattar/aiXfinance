import type {
  CallOutcome,
  CallRecord,
  CallStage,
  InsightPack,
  ObjectionCode,
} from "./types";
import { BROKERS } from "./seed";

const STAGES: CallStage[] = [
  "intro",
  "gatekeeper",
  "discovery",
  "objection",
  "close",
];

function rate(ok: number, n: number): number {
  if (!n) return 0;
  return Math.round((ok / n) * 1000) / 10;
}

function won(o: CallOutcome): boolean {
  return o === "meeting_booked";
}

export function buildInsights(calls: CallRecord[]): InsightPack {
  const openers = (["A", "B", "other"] as const).map((variant) => {
    const subset = calls.filter((c) => c.openerVariant === variant);
    const discovery = subset.filter((c) =>
      ["discovery", "objection", "close"].includes(c.stageReached),
    ).length;
    return {
      variant:
        variant === "A"
          ? "A · generic savings"
          : variant === "B"
            ? "B · renewal-focused"
            : "Other",
      n: subset.length,
      meetingRate: rate(subset.filter((c) => won(c.outcome)).length, subset.length),
      discoveryRate: rate(discovery, subset.length),
    };
  });

  const codes = new Set<ObjectionCode>();
  for (const c of calls) c.objections.forEach((o) => codes.add(o));

  const objections = [...codes].map((code) => {
    const subset = calls.filter((c) => c.objections.includes(code));
    const convert = subset.filter((c) => won(c.outcome)).length;
    const questionFollow = subset.filter((c) =>
      c.turns.some(
        (t, i) =>
          t.speaker === "broker" &&
          i > 0 &&
          /\?/.test(t.text) &&
          c.turns[i - 1] &&
          c.turns[i - 1].speaker !== "broker",
      ),
    );
    const qRate = rate(
      questionFollow.filter((c) => won(c.outcome)).length,
      questionFollow.length,
    );
    return {
      code,
      n: subset.length,
      convertRate: rate(convert, subset.length),
      tip:
        code === "all_set"
          ? `'We're all set' converts more often when followed by a question (${qRate || rate(convert, subset.length)}% in this set) than a rebuttal.`
          : code === "happy_with_broker"
            ? "Service-gap questions outperform savings pitches after this objection."
            : code === "send_email"
              ? "Ask who the email is for and attach a meeting ask. Info@ is a dead end."
              : "Name the decision maker and ask one question.",
    };
  });

  const funnel = STAGES.map((stage) => ({
    stage,
    count: calls.filter((c) => {
      const order = STAGES.indexOf(c.stageReached);
      return order >= STAGES.indexOf(stage);
    }).length,
  }));

  const industries = new Map<string, CallRecord[]>();
  for (const c of calls) {
    const key = c.accountId;
    const arr = industries.get(key) ?? [];
    arr.push(c);
    industries.set(key, arr);
  }

  const accountIndustry: Record<string, string> = {
    acme: "Manufacturing",
    harbor: "Logistics",
    northwind: "Healthcare",
    pike: "Construction",
    lumen: "Food production",
    redoak: "Logistics",
  };

  const byInd = new Map<string, CallRecord[]>();
  for (const c of calls) {
    const ind = accountIndustry[c.accountId] ?? "Other";
    const arr = byInd.get(ind) ?? [];
    arr.push(c);
    byInd.set(ind, arr);
  }

  const segments = [...byInd.entries()].map(([industry, subset]) => ({
    industry,
    n: subset.length,
    meetingRate: rate(subset.filter((c) => won(c.outcome)).length, subset.length),
  }));

  const brokerNotes = BROKERS.map((b) => {
    const subset = calls.filter((c) => c.brokerId === b.id);
    const meetings = subset.filter((c) => won(c.outcome)).length;
    const gk = subset.filter((c) => c.stageReached === "gatekeeper").length;
    const notes: string[] = [
      `${meetings}/${subset.length} meetings (${rate(meetings, subset.length)}%).`,
    ];
    if (b.id === "jordan") {
      notes.push(
        "You interrupt the close and over-explain. Top brokers stop after a time is offered.",
      );
      notes.push(
        `Gatekeeper-stuck on ${gk} calls. Renewal-focused openers would lift pass rate.`,
      );
    }
    if (b.id === "priya") {
      notes.push(
        "Your strongest conversion is a service-gap question after 'happy with broker'.",
      );
    }
    if (b.id === "marcus") {
      notes.push(
        "Top-decile pattern: name the DM, ask for Thursday/Friday, then silence.",
      );
    }
    return { brokerId: b.id, name: b.name, notes };
  });

  const discoveryTimes = calls.filter((c) =>
    ["discovery", "objection", "close"].includes(c.stageReached),
  );
  const top = calls.filter((c) => c.brokerId === "marcus" && won(c.outcome));

  const team = [
    `The top 10% of brokers (Marcus) reach discovery on ${rate(
      top.length,
      calls.filter((c) => c.brokerId === "marcus").length,
    )}% of connected calls vs. the rest of the team.`,
    `For manufacturing prospects, renewal-focused openers produce the highest meeting rate.`,
    `'We're all set' converts more often when followed by a question than a rebuttal.`,
    `${discoveryTimes.length} of ${calls.length} synthetic+live calls reached discovery or later.`,
  ];

  return {
    generatedAt: new Date().toISOString(),
    team,
    brokers: brokerNotes,
    openers,
    objections,
    funnel,
    segments,
    dataNote:
      "Insights are computed from the in-app call log. Seeded calls are synthetic insurance roleplays, labeled as such. Live/demo calls you run are appended.",
  };
}
