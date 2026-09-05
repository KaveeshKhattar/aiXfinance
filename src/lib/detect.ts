import type {
  CallStage,
  Momentum,
  ObjectionCode,
  ObjectionKind,
  SpeakerRole,
  Turn,
} from "./types";
import { normalize } from "./normalize";

const GATEKEEPER_CUES = [
  "what is this regarding",
  "what's this regarding",
  "whats this regarding",
  "send an email",
  "send a email",
  "just email",
  "email it over",
  "who are you trying to reach",
  "who would you like to speak",
  "can i take a message",
  "she's in a meeting",
  "he's in a meeting",
  "they're in a meeting",
  "may i ask who's calling",
  "company do you represent",
];

const DECISION_CUES = [
  "i handle",
  "i'm the owner",
  "i am the owner",
  "i'm the president",
  "this is sarah",
  "this is the owner",
  "i make those decisions",
  "our insurance",
  "our broker",
  "we renew",
  "i'm the one who",
  "speaking",
];

const BROKER_CUES = [
  "calling from",
  "i'm calling",
  "insurance broker",
  "brokerage",
  "commercial insurance",
  "your renewal",
  "twelve minute",
  "12 minute",
  "book a",
  "does thursday",
  "does friday",
];

const OBJECTIONS: { code: ObjectionCode; patterns: string[]; kind: ObjectionKind }[] =
  [
    {
      code: "send_email",
      kind: "reflex",
      patterns: [
        "send an email",
        "send a email",
        "just email",
        "email me",
        "email it",
        "put it in an email",
        "info@",
      ],
    },
    {
      code: "what_regarding",
      kind: "reflex",
      patterns: [
        "what is this regarding",
        "what's this regarding",
        "whats this regarding",
        "what is this about",
        "what's this about",
      ],
    },
    {
      code: "who_trying_to_reach",
      kind: "reflex",
      patterns: [
        "who are you trying to reach",
        "who do you want to speak",
        "who are you looking for",
      ],
    },
    {
      code: "all_set",
      kind: "reflex",
      patterns: [
        "we're all set",
        "we are all set",
        "all set thanks",
        "we're good",
        "we are good",
      ],
    },
    {
      code: "happy_with_broker",
      kind: "genuine",
      patterns: [
        "happy with our broker",
        "happy with our current",
        "like our broker",
        "already have a broker",
        "work with a broker",
      ],
    },
    {
      code: "no_time",
      kind: "reflex",
      patterns: [
        "don't have time",
        "do not have time",
        "in a meeting",
        "kind of busy",
        "caught me at a bad",
      ],
    },
    {
      code: "not_interested",
      kind: "reflex",
      patterns: ["not interested", "no thanks", "no thank you"],
    },
    {
      code: "call_back_later",
      kind: "reflex",
      patterns: ["call back", "call me later", "try me next week"],
    },
    {
      code: "already_renewed",
      kind: "genuine",
      patterns: ["just renewed", "already renewed", "renewed last month"],
    },
    {
      code: "send_info",
      kind: "reflex",
      patterns: ["send some information", "send info", "mail me something"],
    },
    {
      code: "bad_timing",
      kind: "genuine",
      patterns: ["not a good time", "bad time", "maybe next year"],
    },
    {
      code: "price_shopping",
      kind: "genuine",
      patterns: ["just looking for a quote", "lowest price", "shop rates"],
    },
  ];

const SOFT_YES = [
  "that could work",
  "i could do",
  "thursday might",
  "friday might",
  "send me a calendar",
  "let's do it",
  "lets do it",
  "ok let's talk",
  "okay let's",
  "sure i can meet",
  "i have 15 minutes",
  "i have fifteen",
];

const BUYING = [
  "what would that look like",
  "how do you usually",
  "our renewal is",
  "we have a claim",
  "service has been",
  "i've been meaning to",
  "we might be open",
];

export function detectSpeaker(text: string, fallback: SpeakerRole): SpeakerRole {
  const n = normalize(text);
  const gk = GATEKEEPER_CUES.some((p) => n.includes(p));
  const dm = DECISION_CUES.some((p) => n.includes(p));
  const br = BROKER_CUES.some((p) => n.includes(p));
  if (br && !gk && !dm) return "broker";
  if (gk && !dm) return "gatekeeper";
  if (dm) return "decision_maker";
  return fallback;
}

export function detectObjection(text: string): {
  code: ObjectionCode;
  kind: ObjectionKind;
} {
  const n = normalize(text);
  for (const o of OBJECTIONS) {
    if (o.patterns.some((p) => n.includes(p))) {
      return { code: o.code, kind: o.kind };
    }
  }
  return { code: "none", kind: "none" };
}

export function detectSoftYes(text: string): boolean {
  const n = normalize(text);
  return SOFT_YES.some((p) => n.includes(p));
}

export function detectBuyingSignal(text: string): boolean {
  const n = normalize(text);
  return BUYING.some((p) => n.includes(p));
}

export function inferStage(turns: Turn[], current: SpeakerRole): CallStage {
  const lastProspect = [...turns]
    .reverse()
    .find((t) => t.speaker !== "broker");
  const blob = turns.map((t) => normalize(t.text)).join(" ");
  const last = lastProspect ? normalize(lastProspect.text) : "";

  if (
    /thursday|friday|calendar|15 minutes|twelve minute|book|hold that time/.test(
      blob,
    ) &&
    (detectSoftYes(last) || /meet|calendar|thursday|friday/.test(blob))
  ) {
    return "close";
  }

  const obj = lastProspect ? detectObjection(lastProspect.text) : { code: "none" };
  if (
    obj.code !== "none" &&
    obj.code !== "what_regarding" &&
    obj.code !== "who_trying_to_reach"
  ) {
    if (
      current === "decision_maker" ||
      blob.includes("our broker") ||
      blob.includes("renew")
    ) {
      return "objection";
    }
  }

  if (
    current === "gatekeeper" ||
    GATEKEEPER_CUES.some((p) => last.includes(p))
  ) {
    const pastGk = turns.some(
      (t) =>
        t.speaker === "decision_maker" ||
        detectSpeaker(t.text, t.speaker) === "decision_maker",
    );
    if (!pastGk) return "gatekeeper";
  }

  if (
    /renew|coverage|broker|claim|premium|program|who handles/.test(blob) &&
    turns.length > 2
  ) {
    return "discovery";
  }

  if (turns.length <= 2) return "intro";
  if (current === "decision_maker") return "discovery";
  return turns.some((t) => t.speaker === "gatekeeper")
    ? "gatekeeper"
    : "intro";
}

export function inferMomentum(turns: Turn[], softYes: boolean, buying: boolean): Momentum {
  if (softYes) return "hot";
  if (buying) return "warming";
  const last = turns[turns.length - 1];
  if (!last) return "neutral";
  const obj = detectObjection(last.text);
  if (obj.code === "not_interested" || obj.code === "all_set") return "cold";
  if (obj.code !== "none") return "neutral";
  return turns.length > 4 ? "warming" : "neutral";
}
