import { NextResponse } from "next/server";
import { coachTurn } from "@/lib/coach-engine";
import { llmConfigured, maybePolishWhisper } from "@/lib/llm";
import { emitPrismTrace, prismConfigured } from "@/lib/prism";
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
  const latencyMs = Date.now() - started;
  const coachSource = whisper && llmConfigured() ? "llm_polished" : "local_playbook";

  await emitPrismTrace({
    model: coachSource === "llm_polished" ? process.env.LLM_MODEL ?? "llm" : "binder-local-playbook",
    inputMessages: [
      {
        role: "system",
        content:
          "You are Binder, a real-time insurance sales coach. Give one immediately usable line or stay silent. Never invent pricing, coverage, carriers, or policy facts.",
      },
      {
        role: "user",
        content: JSON.stringify({
          account,
          broker,
          transcriptTail,
        }),
      },
    ],
    outputMessage: whisper ?? "SILENT",
    latencyMs,
    sessionId: body.sessionId,
    agentId: "binder-live-coach",
    agentName: "Binder Live Coach",
    metadata: {
      route: "/api/coach",
      accountId: body.accountId,
      brokerId: body.brokerId,
      stage: state.stage,
      speaker: state.speaker,
      objection: state.objection,
      objectionKind: state.objectionKind,
      intervention: state.intervention,
      coachSource,
    },
  });

  return NextResponse.json({
    ...state,
    whisper,
    accountHint,
    latencyMs,
    coachSource,
    prismConnected: prismConfigured(),
  });
}
