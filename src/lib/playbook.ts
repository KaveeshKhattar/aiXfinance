import type { Account, BrokerProfile, ObjectionCode } from "./types";

function dm(account?: Account | null): string {
  return account?.decisionMaker ?? "the person who handles insurance";
}

function renewalAsk(account?: Account | null): string {
  if (account?.renewalMonth) {
    return `Confirm ${account.renewalMonth} is still the renewal — don't invent a date.`;
  }
  return "Ask when the program renews. Do not guess.";
}

const LINES: Record<
  ObjectionCode,
  (account?: Account | null, broker?: BrokerProfile | null) => string
> = {
  none: () => "",
  what_regarding: (a) =>
    `It's about ${a?.name ?? "their"} commercial insurance renewal — is ${dm(a)} the right person for that?`,
  send_email: (a) =>
    `Happy to send it — is ${dm(a)} the right inbox, and would Thursday or Friday be better for a 12-minute follow-up?`,
  who_trying_to_reach: (a) =>
    `Whoever owns the insurance renewal — usually the owner or ops. Who would that be at ${a?.name ?? "the company"}?`,
  all_set: (a) =>
    `Totally fair — not replacing anyone today. One question: when does ${a?.name ?? "the"} program renew?`,
  happy_with_broker: (a) => {
    if (a?.lastObjection === "happy_with_broker") {
      return `You heard this before — ask what they'd change about that broker relationship.`;
    }
    return `Glad that's working. If you could change one thing about that relationship, what would it be?`;
  },
  no_time: () =>
    `Understood — I'll be brief. Does Tuesday at 10 or Thursday at 2 work for 12 minutes?`,
  not_interested: (a) =>
    `I'll keep it short. ${renewalAsk(a)} If it's far out, I'll go.`,
  call_back_later: () =>
    `Sure — what day should I try, and is this still the best number?`,
  already_renewed: () =>
    `Got it — when does this new term end? I'll note it and not pitch today.`,
  send_info: (a) =>
    `I can. To make it useful: is ${dm(a)} the decision maker, and when is renewal?`,
  bad_timing: (a) =>
    `Then I won't pitch. ${renewalAsk(a)} I'll put a reminder and hang up.`,
  price_shopping: () =>
    `I don't quote on a cold call. If a 12-minute fit check is useful, Thursday or Friday?`,
};

export function lineForObjection(
  code: ObjectionCode,
  account?: Account | null,
  broker?: BrokerProfile | null,
): string {
  return LINES[code](account, broker);
}

export function closeLine(account?: Account | null): string {
  const who = dm(account);
  return `Ask for a 12-minute meeting with ${who}: Thursday 10 or Friday 2. Then stop talking.`;
}

export function discoveryLine(account?: Account | null): string {
  if (account?.renewalMonth) {
    return `Ask who still owns the ${account.renewalMonth} renewal — then go quiet.`;
  }
  return "Ask who handles the insurance renewal. Then listen.";
}

export const FORBIDDEN = [
  "Do not invent coverage terms, prices, premiums, or carrier relationships.",
  "Do not claim to know the prospect's policy unless it is in account history.",
  "If a fact is unknown, tell the broker to ask — never to assert.",
];
