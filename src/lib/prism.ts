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

export async function emitPrismTrace(trace: PrismTrace): Promise<{status:'not_configured'|'sent'|'failed'}> {
  const { host, projectId, apiKey } = prismConfig();
  if (!projectId || !apiKey) return {status:'not_configured'};

  try {
    const res = await fetch(`${host}/api/traces`, {
      method: "POST",
      signal: AbortSignal.timeout(4000),
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
        metadata: {
          app: "binder",
          ...trace.metadata,
        },
      }),
    });

    if (!res.ok) {
      console.warn("PRISM trace failed", res.status);
      return {status:'failed'};
    }
    return {status:'sent'};
  } catch {
    console.warn("PRISM trace failed");
    return {status:'failed'};
  }
}
