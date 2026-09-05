import { countFillers, wordCount } from "./normalize";
import type { Turn } from "./types";
import {
  detectBuyingSignal,
  detectObjection,
  detectSoftYes,
} from "./detect";

export type Intervention = {
  intervene: boolean;
  reason: string;
};

export function shouldIntervene(turns: Turn[]): Intervention {
  const last = turns[turns.length - 1];
  if (!last) return { intervene: false, reason: "no_turn" };

  const prospectTalking =
    last.speaker === "gatekeeper" || last.speaker === "decision_maker";

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
