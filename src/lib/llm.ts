import type { Account, BrokerProfile, Debrief, Turn } from "./types";
import { FORBIDDEN } from "./playbook";
import { ruleDebrief } from "./coach-engine";

function config() {
  return {
    apiKey: process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? "",
    baseUrl: (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(
      /\/$/,
      "",
    ),
    model: process.env.LLM_MODEL ?? "gpt-4o-mini",
  };
}

export function llmConfigured(): boolean {
  return Boolean(config().apiKey);
}

export async function llmDebrief(
  turns: Turn[],
  account?: Account | null,
  broker?: BrokerProfile | null,
): Promise<Debrief> {
  const fallback = ruleDebrief(turns, account);
  const { apiKey, baseUrl, model } = config();
  if (!apiKey) return fallback;

  const transcript = turns
    .map((t) => `${t.speaker}: ${t.text}`)
    .join("\n");

  const sys = [
    "You are Binder, an AI sales coach for insurance brokers.",
    "Return ONLY JSON with keys: whatHappened, outcome, whatWorked, whatDidnt, oneThingToImprove, crm.",
    "crm keys: account, contact, stage, outcome, nextStep, renewal, objections (string[]), notes.",
    "outcome must be one of: meeting_booked, callback, email_promised, no_meeting, gatekeeper_block, in_progress.",
    ...FORBIDDEN,
    "Be brief. The broker will glance, not study.",
  ].join(" ");

  const user = JSON.stringify({
    account,
    broker,
    transcript,
  });

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return fallback;
    const parsed = JSON.parse(content) as Debrief;
    return { ...fallback, ...parsed, inventedNothing: true };
  } catch {
    return fallback;
  }
}

export async function maybePolishWhisper(
  whisper: string,
  transcriptTail: string,
): Promise<string> {
  const { apiKey, baseUrl, model } = config();
  if (!apiKey) return whisper;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 60,
        messages: [
          {
            role: "system",
            content:
              "Rewrite the coaching line so a broker can say it out loud immediately. One sentence. No prices, carriers, or invented policy facts. If the line already works, return it unchanged.",
          },
          {
            role: "user",
            content: `Line: ${whisper}\nRecent: ${transcriptTail}`,
          },
        ],
      }),
    });
    if (!res.ok) return whisper;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const line = data.choices?.[0]?.message?.content?.trim();
    return line || whisper;
  } catch {
    return whisper;
  }
}
