export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function wordCount(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

export const FILLERS = [
  "um",
  "uh",
  "er",
  "ah",
  "like",
  "you know",
  "basically",
  "kind of",
  "sort of",
];

export function countFillers(text: string): number {
  const n = normalize(text);
  let count = 0;
  for (const f of FILLERS) {
    const re = new RegExp(`\\b${f.replace(" ", "\\s+")}\\b`, "g");
    count += n.match(re)?.length ?? 0;
  }
  return count;
}
