import type { SpeakerRole, Turn } from "./types";

const MAP: Record<string, SpeakerRole> = {
  broker: "broker",
  agent: "broker",
  rep: "broker",
  gatekeeper: "gatekeeper",
  receptionist: "gatekeeper",
  assistant: "gatekeeper",
  dm: "decision_maker",
  "decision maker": "decision_maker",
  prospect: "decision_maker",
  customer: "decision_maker",
  sarah: "decision_maker",
  luis: "decision_maker",
  unknown: "unknown",
};

export function parseTranscript(raw: string): Turn[] {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const turns: Turn[] = [];
  let t = 0;
  for (const line of lines) {
    const m = line.match(/^([A-Za-z ]{2,24})\s*[:—-]\s*(.+)$/);
    if (!m) {
      turns.push({ speaker: "unknown", text: line, atMs: t });
      t += 3000;
      continue;
    }
    const key = m[1].trim().toLowerCase();
    const speaker = MAP[key] ?? (key.includes("broker") ? "broker" : "unknown");
    turns.push({ speaker, text: m[2].trim(), atMs: t });
    t += 3000;
  }
  return turns;
}
