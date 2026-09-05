import { promises as fs } from "fs";
import path from "path";
import { ACCOUNTS, BROKERS, CALLS } from "./seed";
import { ruleDebrief } from "./coach-engine";
import type { Account, BrokerProfile, CallRecord, Debrief } from "./types";
import type {AgentEvent} from './types';

const DIR = path.join(process.cwd(), "data");
const FILES = {
  accounts: path.join(DIR, "accounts.json"),
  brokers: path.join(DIR, "brokers.json"),
  calls: path.join(DIR, "calls.json"),
};

async function ensure() {
  await fs.mkdir(DIR, { recursive: true });
  for(const [key,value] of [['accounts',ACCOUNTS],['brokers',BROKERS],['calls',CALLS]] as const){try{await fs.writeFile(FILES[key],JSON.stringify(value,null,2),{flag:'wx'});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}}
}

async function readJson<T>(file: string, _fallback: T): Promise<T> {
  await ensure();
  const raw = await fs.readFile(file, "utf8");
  return JSON.parse(raw) as T;
}

async function writeJson(file: string, value: unknown) {
  await ensure();
  const tmp=file+'.'+crypto.randomUUID()+'.tmp';
  await fs.writeFile(tmp, JSON.stringify(value, null, 2));
  await fs.rename(tmp,file);
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

async function saveCallInternal(call: CallRecord): Promise<CallRecord> {
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
      notes: call.debrief ? `${call.synthetic?'Synthetic roleplay: ':''}${call.debrief.whatHappened} Next step: ${call.debrief.crm.nextStep}` : accounts[aidx].notes,
    };
    await writeJson(FILES.accounts, accounts);
  }
  return call;
}

const globalStore=globalThis as typeof globalThis & {binderWriteQueue?:Promise<unknown>};
export async function saveCall(call:CallRecord):Promise<CallRecord>{
 const run=(globalStore.binderWriteQueue||Promise.resolve()).then(()=>saveCallInternal(call));
 globalStore.binderWriteQueue=run.catch(()=>undefined);return run;
}
export async function appendAgentEvents(id:string,events:AgentEvent[]){
 if(!/^[\w-]{1,150}$/.test(id))throw Error('Invalid session ID');await ensure();
 await fs.appendFile(path.join(DIR,'agent-events.jsonl'),events.map(e=>JSON.stringify({sessionId:id,...e})).join('\n')+'\n');
}
export async function getAgentEvents(id:string):Promise<AgentEvent[]>{
 try{const raw=await fs.readFile(path.join(DIR,'agent-events.jsonl'),'utf8');return raw.split('\n').filter(Boolean).flatMap(line=>{try{const e=JSON.parse(line);return e.sessionId===id?[e]:[];}catch{return [];}});}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return [];throw e;}
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
