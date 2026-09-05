export type CallStage =
  | "intro"
  | "gatekeeper"
  | "discovery"
  | "objection"
  | "close";

export type SpeakerRole =
  | "broker"
  | "gatekeeper"
  | "decision_maker"
  | "unknown";

export type Momentum = "cold" | "neutral" | "warming" | "hot";

export type CallOutcome =
  | "meeting_booked"
  | "callback"
  | "email_promised"
  | "no_meeting"
  | "gatekeeper_block"
  | "in_progress";

export type ObjectionCode =
  | "send_email"
  | "what_regarding"
  | "who_trying_to_reach"
  | "all_set"
  | "happy_with_broker"
  | "no_time"
  | "not_interested"
  | "call_back_later"
  | "already_renewed"
  | "send_info"
  | "bad_timing"
  | "price_shopping"
  | "none";

export type ObjectionKind = "reflex" | "genuine" | "none";

export type Turn = {
  speaker: SpeakerRole;
  text: string;
  atMs: number;
};

export type ConversationState = {
  stage: CallStage;
  speaker: SpeakerRole;
  objection: ObjectionCode;
  objectionKind: ObjectionKind;
  momentum: Momentum;
  intervention: boolean;
  whisper: string | null;
  reason: string;
  talkListen: { brokerWords: number; prospectWords: number };
  fillerCount: number;
  buyingSignal: boolean;
  softYes: boolean;
};

export type Account = {
  id: string;
  name: string;
  industry: string;
  decisionMaker: string | null;
  decisionMakerTitle: string | null;
  renewalMonth: string | null;
  lastCallAt: string | null;
  lastObjection: ObjectionCode | null;
  lastApproach: string | null;
  lastOutcome: CallOutcome | null;
  notes: string;
  doNotRepeat: string[];
};

export type BrokerProfile = {
  id: string;
  name: string;
  strength: string;
  weakness: string;
  bestOpener: string;
  commonMistake: string;
  talkListenTarget: number;
};

export type CallRecord = {
  id: string;
  accountId: string;
  brokerId: string;
  startedAt: string;
  endedAt: string | null;
  openerVariant: "A" | "B" | "other";
  turns: Turn[];
  stageReached: CallStage;
  outcome: CallOutcome;
  objections: ObjectionCode[];
  debrief: Debrief | null;
  synthetic: boolean;
};

export type Debrief = {
  whatHappened: string;
  outcome: CallOutcome;
  whatWorked: string;
  whatDidnt: string;
  oneThingToImprove: string;
  crm: CrmWriteback;
  inventedNothing: true;
};

export type CrmWriteback = {
  account: string;
  contact: string | null;
  stage: CallStage;
  outcome: CallOutcome;
  nextStep: string;
  renewal: string | null;
  objections: string[];
  notes: string;
};

export type CoachRequest = {
  accountId?: string;
  brokerId?: string;
  turns: Turn[];
};

export type CoachResponse = ConversationState & {
  accountHint: string | null;
  latencyMs: number;
};

export type InsightPack = {
  generatedAt: string;
  team: string[];
  brokers: { brokerId: string; name: string; notes: string[] }[];
  openers: { variant: string; meetingRate: number; discoveryRate: number; n: number }[];
  objections: { code: ObjectionCode; convertRate: number; n: number; tip: string }[];
  funnel: { stage: CallStage; count: number }[];
  segments: { industry: string; meetingRate: number; n: number }[];
  dataNote: string;
};
