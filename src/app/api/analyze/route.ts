import { NextResponse } from "next/server";
import { coachTurn } from "@/lib/coach-engine";
import { detectObjection } from "@/lib/detect";
import { llmConfigured, llmDebrief } from "@/lib/llm";
import { discoveryLine, lineForObjection } from "@/lib/playbook";
import { emitPrismTrace, prismConfigured } from "@/lib/prism";
import { attachDebrief, getAccount, getBroker, saveCall } from "@/lib/store";
import type { CallRecord, ObjectionCode, Turn } from "@/lib/types";

export async function POST(req: Request) {
  const started = Date.now();
  const body = (await req.json()) as {
    callId?: string;
    accountId?: string;
    brokerId?: string;
    openerVariant?: CallRecord["openerVariant"];
    sessionId?: string;
    turns: Turn[];
    synthetic?: boolean;
  };

  const turns = body.turns ?? [];
  const account = body.accountId ? await getAccount(body.accountId) : undefined;
  const broker = body.brokerId ? await getBroker(body.brokerId) : undefined;
  const debrief = await llmDebrief(turns, account, broker);

  const objections = [
    ...new Set(
      turns
        .map((t) => detectObjection(t.text).code)
        .filter((c): c is ObjectionCode => c !== "none"),
    ),
  ];

  const call: CallRecord = {
    id: body.callId ?? `live-${Date.now()}`,
    accountId: body.accountId ?? "northwind",
    brokerId: body.brokerId ?? "jordan",
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    openerVariant: body.openerVariant ?? "other",
    turns,
    stageReached: debrief.crm.stage,
    outcome: debrief.outcome,
    objections,
    debrief,
    synthetic: Boolean(body.synthetic),
  };

  const state = coachTurn(turns, account, broker);
  const nextLine =
    state.whisper ??
    (state.objection !== "none"
      ? lineForObjection(state.objection, account, broker)
      : discoveryLine(account));

  await saveCall(call);
  await attachDebrief(call.id, debrief);
  const latencyMs = Date.now() - started;

  await emitPrismTrace({
    model: llmConfigured() ? process.env.LLM_MODEL ?? "llm" : "binder-rule-debrief",
    inputMessages: [
      {
        role: "system",
        content:
          "You are Binder, a post-call insurance sales coach. Summarize what happened, the outcome, coaching feedback, and CRM-safe facts without inventing policy details.",
      },
      {
        role: "user",
        content: JSON.stringify({
          account,
          broker,
          transcript: turns,
        }),
      },
    ],
    outputMessage: JSON.stringify({
      debrief,
      nextLine,
      crm: debrief.crm,
    }),
    latencyMs,
    sessionId: body.sessionId ?? call.id,
    agentId: "binder-post-call-analyst",
    agentName: "Binder Post-call Analyst",
    metadata: {
      route: "/api/analyze",
      callId: call.id,
      accountId: call.accountId,
      brokerId: call.brokerId,
      stage: state.stage,
      outcome: call.outcome,
      objections,
      synthetic: call.synthetic,
      coachSource: llmConfigured() ? "llm_debrief" : "rule_debrief",
    },
  });

  return NextResponse.json({
    call,
    debrief,
    state,
    nextLine,
    prismConnected: prismConfigured(),
  });
}
