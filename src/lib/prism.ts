type PrismMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type PrismTrace = {
  model: string;
  inputMessages: PrismMessage[];
  outputMessage: string;
  latencyMs: number;
  sessionId?: string;
  userIdentifier?: string;
  agentId: string;
  agentName: string;
  metadata?: Record<string, unknown>;
};

function prismConfig() {
  return {
    host: (process.env.PRISMTRACE_HOST ?? "https://prism.blockconvey.com").replace(
      /\/$/,
      "",
    ),
    projectId: process.env.PRISMTRACE_PROJECT_ID ?? "",
    apiKey: process.env.PRISMTRACE_API_KEY ?? "",
  };
}

export function prismConfigured(): boolean {
  const { projectId, apiKey } = prismConfig();
  return Boolean(projectId && apiKey);
}

function roughTokenCount(value: string): number {
  return Math.ceil(value.split(/\s+/).filter(Boolean).length * 1.3);
}

export async function emitPrismTrace(trace: PrismTrace): Promise<void> {
  const { host, projectId, apiKey } = prismConfig();
  if (!projectId || !apiKey) return;

  const inputText = trace.inputMessages.map((m) => m.content).join("\n");

  try {
    const res = await fetch(`${host}/api/traces`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PRISMtrace-Key": apiKey,
      },
      body: JSON.stringify({
        project_id: projectId,
        model: trace.model,
        input_messages: trace.inputMessages,
        output_message: trace.outputMessage,
        latency_ms: trace.latencyMs,
        session_id: trace.sessionId,
        user_identifier: trace.userIdentifier,
        agent_id: trace.agentId,
        agent_name: trace.agentName,
        token_count_input: roughTokenCount(inputText),
        token_count_output: roughTokenCount(trace.outputMessage),
        metadata: {
          app: "binder",
          ...trace.metadata,
        },
      }),
    });

    if (!res.ok) {
      console.warn("PRISM trace failed", res.status, await res.text());
    }
  } catch (error) {
    console.warn("PRISM trace failed", error);
  }
}
