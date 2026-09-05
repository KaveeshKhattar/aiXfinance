import { promises as fs } from "fs";
import path from "path";
import { ACCOUNTS, BROKERS, CALLS } from "./seed";
import { ruleDebrief } from "./coach-engine";
import type { Account, BrokerProfile, CallRecord, Debrief } from "./types";

const DIR = path.join(process.cwd(), "data");
const FILES = {
  accounts: path.join(DIR, "accounts.json"),
  brokers: path.join(DIR, "brokers.json"),
  calls: path.join(DIR, "calls.json"),
};

async function ensure() {
  await fs.mkdir(DIR, { recursive: true });
  try {
    await fs.access(FILES.accounts);
  } catch {
    await fs.writeFile(FILES.accounts, JSON.stringify(ACCOUNTS, null, 2));
    await fs.writeFile(FILES.brokers, JSON.stringify(BROKERS, null, 2));
    await fs.writeFile(FILES.calls, JSON.stringify(CALLS, null, 2));
  }
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  await ensure();
  const raw = await fs.readFile(file, "utf8");
  return JSON.parse(raw) as T;
}

async function writeJson(file: string, value: unknown) {
  await ensure();
  await fs.writeFile(file, JSON.stringify(value, null, 2));
}

export async function getAccounts(): Promise<Account[]> {
  return readJson(FILES.accounts, ACCOUNTS);
}

export async function getAccount(id: string): Promise<Account | undefined> {
  const all = await getAccounts();
  return all.find((a) => a.id === id);
}

export async function getBrokers(): Promise<BrokerProfile[]> {
  return readJson(FILES.brokers, BROKERS);
}

export async function getBroker(id: string): Promise<BrokerProfile | undefined> {
  const all = await getBrokers();
  return all.find((b) => b.id === id);
}

export async function getCalls(): Promise<CallRecord[]> {
  return readJson(FILES.calls, CALLS);
}

export async function getCall(id: string): Promise<CallRecord | undefined> {
  const all = await getCalls();
  return all.find((c) => c.id === id);
}

export async function saveCall(call: CallRecord): Promise<CallRecord> {
  const calls = await getCalls();
  const idx = calls.findIndex((c) => c.id === call.id);
  if (idx >= 0) calls[idx] = call;
  else calls.unshift(call);
  await writeJson(FILES.calls, calls);

  const accounts = await getAccounts();
  const aidx = accounts.findIndex((a) => a.id === call.accountId);
  if (aidx >= 0) {
    const lastObj = call.objections[call.objections.length - 1] ?? null;
    accounts[aidx] = {
      ...accounts[aidx],
      lastCallAt: call.startedAt.slice(0, 10),
      lastObjection: lastObj,
      lastOutcome: call.outcome,
      lastApproach: call.debrief?.whatHappened ?? accounts[aidx].lastApproach,
    };
    await writeJson(FILES.accounts, accounts);
  }
  return call;
}

export async function attachDebrief(
  callId: string,
  debrief: Debrief,
): Promise<CallRecord | undefined> {
  const call = await getCall(callId);
  if (!call) return undefined;
  call.debrief = debrief;
  call.outcome = debrief.outcome;
  return saveCall(call);
}

export function synthesizeDebrief(call: CallRecord, account?: Account | null): Debrief {
  if (call.debrief) return call.debrief;
  return ruleDebrief(call.turns, account);
}
