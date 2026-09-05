import {
  detectBuyingSignal,
  detectObjection,
  detectSoftYes,
  detectSpeaker,
  inferMomentum,
  inferStage,
} from "./detect";
import { shouldIntervene } from "./intervention";
import { closeLine, discoveryLine, lineForObjection } from "./playbook";
import { countFillers, wordCount } from "./normalize";
import { callOutcome, meetingEvidence } from './outcome';
import type {
  Account,
  BrokerProfile,
  ConversationState,
  SpeakerRole,
  CoachingLevel,
  Turn,
} from "./types";

function lastNonBroker(turns: Turn[]): Turn | undefined {
  return [...turns].reverse().find((t) => t.speaker !== "broker");
}

function talkListen(turns: Turn[]) {
  let brokerWords = 0;
  let prospectWords = 0;
  for (const t of turns) {
    const w = wordCount(t.text);
    if (t.speaker === "broker") brokerWords += w;
    else prospectWords += w;
  }
  return { brokerWords, prospectWords };
}

export function coachTurn(
  turns: Turn[],
  account?: Account | null,
  broker?: BrokerProfile | null,
  level: CoachingLevel = "standard",
): ConversationState {
  const last = turns[turns.length - 1];
  const labeled: Turn[] = turns.map((t) => {
    if (t.speaker !== "unknown") return t;
    return { ...t, speaker: detectSpeaker(t.text, "unknown") };
  });

  const latest = labeled[labeled.length - 1] ?? last;
  const speaker: SpeakerRole = latest?.speaker ?? "unknown";
  const prospect = lastNonBroker(labeled);
  const obj = prospect
    ? detectObjection(prospect.text)
    : { code: "none" as const, kind: "none" as const };
  const softYes = labeled.some((t) => t.speaker !== 'broker' && detectSoftYes(t.text));
  const buying = labeled.some((t) => t.speaker !== 'broker' && detectBuyingSignal(t.text));
  const stage = inferStage(labeled, speaker);
  const momentum = inferMomentum(labeled, softYes, buying);
  const { intervene, reason } = shouldIntervene(labeled, level);

  let whisper: string | null = null;
  if (intervene) {
    if(reason==='product_scope_question') {
      whisper='We help businesses review their commercial insurance program. I’m not quoting on this call — who handles that review?';
    } else if (reason === 'unverified_product_fact') {
      whisper = 'Don’t guess on coverage or price. Acknowledge the question, then ask what they are trying to solve and who handles the review.';
    } else if (reason === 'prospect_question') {
      whisper = stage === 'gatekeeper'
        ? lineForObjection('what_regarding', account, broker)
        : discoveryLine(account);
    } else if (reason === 'beginner_next_move') {
      whisper = stage === 'gatekeeper' ? lineForObjection('what_regarding', account, broker) : discoveryLine(account);
    } else if(reason==='respect_refusal') {
      whisper='Understood. Thank you for your time.';
    } else if (reason === "soft_yes_stop_selling" || reason === "broker_still_selling_after_yes") {
      whisper = closeLine(account);
    } else if (reason === "rambling") {
      whisper =
        broker?.weakness.toLowerCase().includes("talk")
          ? "You're over-explaining. One question, then stop."
          : "Too long. Ask one question and go quiet.";
    } else if (reason === "filler_heavy") {
      whisper = "Cut the fillers. Ask the renewal question.";
    } else if (reason === "buying_signal_advance") {
      whisper = closeLine(account);
    } else if (obj.code !== "none") {
      whisper = lineForObjection(obj.code, account, broker);
    } else if (stage === "gatekeeper") {
      whisper = lineForObjection("what_regarding", account, broker);
    } else if (stage === "close") {
      whisper = closeLine(account);
    } else if (stage === "discovery") {
      whisper = discoveryLine(account);
    } else {
      whisper = discoveryLine(account);
    }
  }

  if (whisper && /premium|percent|hartford|travelers|\$\d/.test(whisper.toLowerCase())) {
    whisper = "Don't quote numbers. Ask when they renew.";
  }

  return {
    stage,
    speaker,
    objection: obj.code,
    objectionKind: obj.kind,
    momentum,
    intervention: intervene,
    whisper,
    reason,
    talkListen: talkListen(labeled),
    fillerCount: labeled.reduce((n, t) => n + countFillers(t.text), 0),
    buyingSignal: buying,
    softYes,
  };
}

export function ruleDebrief(turns: Turn[], account?: Account | null) {
  const state = coachTurn(turns, account);
  const reachedDm = turns.some((t) => t.speaker === "decision_maker");
  const outcome = callOutcome(turns);

  const whatWorked =
    state.stage === "discovery" || state.stage === "close"
      ? "Got past the opener into a real conversation."
      : reachedDm
        ? "Reached a decision maker."
        : "Opened the call; still stuck at the gate.";

  const whatDidnt =
    state.objection !== "none"
      ? `Stalled on "${state.objection.replace(/_/g, " ")}".`
      : "Did not earn a next step.";

  const oneThing =
    state.talkListen.brokerWords > state.talkListen.prospectWords * 1.4
      ? "Talk less. Ask the renewal question and wait."
      : outcome !== "meeting_booked"
        ? "Ask for one clear next step when interest is expressed; respect a refusal."
        : "Stop selling the moment they agree to a time.";

  return {
    whatHappened: `Call reached ${state.stage}. Counterparty classified as ${state.speaker.replace(/_/g, " ")}.`,
    outcome,
    whatWorked,
    whatDidnt,
    oneThingToImprove: oneThing,
    crm: {
      account: account?.name ?? "Unknown account",
      contact: account?.decisionMaker ?? null,
      stage: state.stage,
      outcome,
      nextStep:
        outcome === "meeting_booked"
          ? "Confirm the full date, timezone and invitation email."
          : "Follow up on renewal date only. Do not resend the same pitch.",
      renewal: account?.renewalMonth ?? null,
      objections:
        state.objection === "none" ? [] : [state.objection.replace(/_/g, " ")],
      notes:
        "Facts limited to what was said on the call and prior account record. No coverage or pricing claimed.",
    },
    inventedNothing: true as const,
    source: 'local_rules',
    evidence: meetingEvidence(turns) === null ? [] : [{turn: meetingEvidence(turns)!, quote: turns[meetingEvidence(turns)!].text}],
  };
}
