import type {Account,BrokerProfile,Debrief,Turn} from './types';
import {ruleDebrief} from './coach-engine';
import {closeAgent,elevenConfigured,runAgent} from './elevenlabs';
import {appendAgentEvents} from './store';
export const llmConfigured=elevenConfigured;
export async function llmDebrief(turns:Turn[],account?:Account|null,broker?:BrokerProfile|null,sessionId:string=crypto.randomUUID(),useAgent=true,slots:string[]=[]):Promise<Debrief>{
 if(!useAgent||!elevenConfigured())return ruleDebrief(turns,account);
 try{const result=await runAgent(sessionId,'debrief',turns,account||undefined,broker||undefined,slots);await appendAgentEvents(sessionId,result.events);return result.debrief!;}
 catch(e){return {...ruleDebrief(turns,account),warning:`ElevenLabs debrief failed: ${e instanceof Error?e.message:'unknown error'}. Local summary shown.`};}
 finally{await closeAgent(sessionId);}
}
