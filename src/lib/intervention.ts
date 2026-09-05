import { countFillers, wordCount } from "./normalize";
import type { CoachingLevel, Turn } from "./types";
import {
  detectBuyingSignal,
  detectObjection,
  detectSoftYes,
} from "./detect";

export type Intervention = {
  intervene: boolean;
  reason: string;
};

export function shouldIntervene(turns: Turn[], level: CoachingLevel = "standard"): Intervention {
  const last = turns[turns.length - 1];
  if (!last) return { intervene: false, reason: "no_turn" };
  if(last.speaker !== 'broker' && /stop calling|do not call|remove me|not interested|no thank you/i.test(last.text)) return {intervene:true,reason:'respect_refusal'};
  // Answer the conversational need without inventing a product fact. The
  // coach may suggest a clarifying question even when the playbook has no
  // exact match.
  if(last.speaker !== 'broker' && /\?|how much|what is|what's|does .*cover/i.test(last.text) && /premium|coverage|deductible|carrier|price|policy cover|insurance cover/i.test(last.text)) return {intervene:true,reason:'unverified_product_fact'};
  if(last.speaker !== 'broker' && /what (insurance|coverage|policy|products?).*(sell|offer|do you)|what.*currently selling|what.*do you sell/i.test(last.text)) return {intervene:true,reason:'product_scope_question'};

  // A mixed microphone stream often has no speaker label. Treat a turn with
  // prospect-language cues as prospect speech for coaching purposes, while
  // retaining `unknown` in the UI instead of claiming diarization certainty.
  const prospectTalking =
    last.speaker === "gatekeeper" || last.speaker === "decision_maker" ||
    (last.speaker === "unknown" && (detectSoftYes(last.text) || detectBuyingSignal(last.text) || detectObjection(last.text).code !== "none" || /\?|regarding|email|who are you|sounds good|meeting|works/i.test(last.text)));

  if (last.speaker === "unknown") {
    const obj = detectObjection(last.text);
    if (obj.code !== "none") {
      return { intervene: true, reason: `objection:${obj.code}` };
    }
  }

  if (prospectTalking) {
    if (detectSoftYes(last.text)) {
      return { intervene: true, reason: "soft_yes_stop_selling" };
    }
    const obj = detectObjection(last.text);
    if (obj.code !== "none") {
      return { intervene: true, reason: `objection:${obj.code}` };
    }
    if (detectBuyingSignal(last.text)) {
      return { intervene: true, reason: "buying_signal_advance" };
    }
    if (/[?]/.test(last.text) || /regarding|who are you|email/.test(last.text.toLowerCase())) {
      return { intervene: true, reason: "prospect_question" };
    }
    if (level === "beginner" && last.speaker !== "broker") {
      return { intervene: true, reason: "beginner_next_move" };
    }
    return { intervene: false, reason: "prospect_talking_listen" };
  }

  if (last.speaker === "broker") {
    const words = wordCount(last.text);
    const fillers = countFillers(last.text);
    if (detectSoftYes(turns[turns.length - 2]?.text ?? "")) {
      return { intervene: true, reason: "broker_still_selling_after_yes" };
    }
    if (words >= 55) {
      return { intervene: true, reason: "rambling" };
    }
    if (fillers >= 3 && words >= 25) {
      return { intervene: true, reason: "filler_heavy" };
    }
    return { intervene: false, reason: "broker_turn_ok" };
  }

  return { intervene: false, reason: "default_silence" };
}
