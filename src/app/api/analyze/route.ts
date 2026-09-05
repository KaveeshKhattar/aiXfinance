import {coachTurn} from '@/lib/coach-engine';
import {detectObjection} from '@/lib/detect';
import {llmDebrief} from '@/lib/llm';
import {elevenModel} from '@/lib/elevenlabs';
import {emitPrismTrace} from '@/lib/prism';
import {getAccount,getBroker,getCall,getAgentEvents,saveCall} from '@/lib/store';
import {apiError,requestSchema,sameOrigin} from '@/lib/validation';
import type {CallRecord,ObjectionCode} from '@/lib/types';
export const runtime='nodejs';
export async function POST(req:Request){try{
 sameOrigin(req);const body=requestSchema.parse(await req.json());const started=Date.now();const id=body.sessionId||crypto.randomUUID();
 const existing=await getCall(id);if(existing?.debrief)return Response.json({call:existing,debrief:existing.debrief,state:coachTurn(existing.turns),nextLine:null});
 const [account,broker]=await Promise.all([body.accountId?getAccount(body.accountId):undefined,body.brokerId?getBroker(body.brokerId):undefined]);
 const debrief=await llmDebrief(body.turns,account,broker,id,body.useAgent!==false,body.meetingSlots);
 const objections=[...new Set(body.turns.filter(t=>t.speaker!=='broker').map(t=>detectObjection(t.text).code).filter((c):c is ObjectionCode=>c!=='none'))];
 const now=Date.now();const duration=Math.max(0,body.turns.at(-1)!.atMs-body.turns[0].atMs);
 const call:CallRecord={id,accountId:account?.id||'unknown',brokerId:broker?.id||'unknown',startedAt:new Date(now-duration).toISOString(),endedAt:new Date(now).toISOString(),openerVariant:'other',turns:body.turns,stageReached:debrief.crm.stage,outcome:debrief.outcome,objections,debrief,synthetic:body.synthetic??false,agentEvents:await getAgentEvents(id)};
 await saveCall(call);
 const trace=await emitPrismTrace({model:debrief.source==='elevenlabs_agent'?elevenModel():'binder-rule-debrief',inputMessages:[{role:'user',content:JSON.stringify({account,broker,transcript:body.turns})}],outputMessage:JSON.stringify(debrief),latencyMs:Date.now()-started,sessionId:id,agentId:'binder-post-call-analyst',agentName:'Binder Post-call Analyst',metadata:{synthetic:call.synthetic,source:debrief.source,tool_events:call.agentEvents}});
 return Response.json({call,debrief,state:coachTurn(body.turns,account,broker),nextLine:coachTurn(body.turns,account,broker).whisper,prismStatus:trace.status});
 }catch(e){return apiError(e);}}
