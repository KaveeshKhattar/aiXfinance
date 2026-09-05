import { NextResponse } from "next/server";
import { coachTurn } from "@/lib/coach-engine";
import { llmConfigured, maybePolishWhisper } from "@/lib/llm";
import { getAccount, getBroker } from "@/lib/store";
import type { CoachRequest } from "@/lib/types";

export async function POST(req: Request) {
  const started = Date.now();
  const body = (await req.json()) as CoachRequest;
  const turns = body.turns ?? [];
  const account = body.accountId ? await getAccount(body.accountId) : undefined;
  const broker = body.brokerId ? await getBroker(body.brokerId) : undefined;
  const state = coachTurn(turns, account, broker);
  const transcriptTail = turns
    .slice(-6)
    .map((turn) => `${turn.speaker}: ${turn.text}`)
    .join("\n");
  const whisper =
    state.whisper && transcriptTail
      ? await maybePolishWhisper(state.whisper, transcriptTail)
      : state.whisper;
  const accountHint = account
    ? `${account.name} · ${account.decisionMaker ?? "DM unknown"} · renews ${account.renewalMonth ?? "?"} · last: ${account.lastObjection?.replace(/_/g, " ") ?? "none"}`
    : null;
  return NextResponse.json({
    ...state,
    whisper,
    accountHint,
    latencyMs: Date.now() - started,
    coachSource: whisper && llmConfigured() ? "llm_polished" : "local_playbook",
  });
}
