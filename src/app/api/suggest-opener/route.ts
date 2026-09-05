import { NextResponse } from "next/server";
import { llmConfigured, suggestOpener } from "@/lib/llm";
import { emitPrismTrace, prismConfigured } from "@/lib/prism";
import { getAccount, getBroker } from "@/lib/store";

export async function POST(req: Request) {
  const started = Date.now();
  const body = (await req.json()) as {
    accountId?: string;
    brokerId?: string;
    sessionId?: string;
  };
  const account = body.accountId ? await getAccount(body.accountId) : undefined;
  const broker = body.brokerId ? await getBroker(body.brokerId) : undefined;
  const line = await suggestOpener(account, broker);
  const latencyMs = Date.now() - started;

  await emitPrismTrace({
    model: llmConfigured() ? process.env.LLM_MODEL ?? "llm" : "binder-rule-opener",
    inputMessages: [
      {
        role: "system",
        content:
          "You are Binder, an AI cold-call coach for insurance brokers. Write ONE opening line the broker can say out loud the moment the call connects.",
      },
      {
        role: "user",
        content: JSON.stringify({
          accountName: account?.name ?? null,
          decisionMaker: account?.decisionMaker ?? null,
          renewalMonth: account?.renewalMonth ?? null,
          brokerName: broker?.name ?? null,
        }),
      },
    ],
    outputMessage: line,
    latencyMs,
    sessionId: body.sessionId,
    agentId: "binder-opener-coach",
    agentName: "Binder Opener Coach",
    metadata: {
      route: "/api/suggest-opener",
      accountId: body.accountId,
      brokerId: body.brokerId,
      coachSource: llmConfigured() ? "llm_opener" : "rule_opener",
    },
  });

  return NextResponse.json({ line, prismConnected: prismConfigured() });
}
