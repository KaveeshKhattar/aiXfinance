import type {Account,BrokerProfile,Debrief,Turn} from './types';
import {ruleDebrief} from './coach-engine';
import {closeAgent,elevenConfigured,runAgent} from './elevenlabs';
import {appendAgentEvents} from './store';
export const llmConfigured=elevenConfigured;

export function suggestOpener(account?:Account|null,broker?:BrokerProfile|null):string{
 const dm=account?.decisionMaker??'the person who handles insurance';
 const company=account?.name??'your company';
 const renewal=account?.renewalMonth?` Your ${account.renewalMonth} renewal is coming up —`:' ';
 const intro=broker?.name?`Hi, this is ${broker.name}`:'Hi';
 return `${intro} calling about ${company}'s commercial insurance program.${renewal} is ${dm} the right person to speak with?`;
}
export async function llmDebrief(turns:Turn[],account?:Account|null,broker?:BrokerProfile|null,sessionId:string=crypto.randomUUID(),useAgent=true,slots:string[]=[]):Promise<Debrief>{
 if(!useAgent||!elevenConfigured())return ruleDebrief(turns,account);
 try{const result=await runAgent(sessionId,'debrief',turns,account||undefined,broker||undefined,slots);await appendAgentEvents(sessionId,result.events);return result.debrief!;}
 catch(e){return {...ruleDebrief(turns,account),warning:`ElevenLabs debrief failed: ${e instanceof Error?e.message:'unknown error'}. Local summary shown.`};}
 finally{await closeAgent(sessionId);}
}
