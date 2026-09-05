import {coachTurn} from '@/lib/coach-engine';
import {elevenConfigured,elevenModel,runAgent} from '@/lib/elevenlabs';
import {emitPrismTrace,prismConfigured} from '@/lib/prism';
import {getAccount,getBroker,appendAgentEvents} from '@/lib/store';
import {apiError,requestSchema,sameOrigin} from '@/lib/validation';
export const runtime='nodejs';
export async function POST(req:Request){try{
 sameOrigin(req);const body=requestSchema.parse(await req.json());const started=Date.now();
 const [account,broker]=await Promise.all([body.accountId?getAccount(body.accountId):undefined,body.brokerId?getBroker(body.brokerId):undefined]);
 let state=coachTurn(body.turns,account,broker,body.coachingLevel||'standard'),coachSource='local_playbook',warning:string|undefined;
 let events:import('@/lib/types').AgentEvent[]=[];
 if(body.useAgent){if(!elevenConfigured())throw Error('ElevenLabs key is missing. Configure it or choose Local rehearsal.');try{const result=await runAgent(body.sessionId||crypto.randomUUID(),'coach',body.turns,account,broker,body.meetingSlots);events=result.events;coachSource='elevenlabs_agent';
   // Keep the agentic trace, but never let an overly conservative model hide a
   // deterministic meeting-progress cue. Local playbook remains the safe floor.
   const local=coachTurn(body.turns,account,broker,body.coachingLevel||'standard');state={...state,...(result.state||{}),whisper:result.state?.whisper||local.whisper,intervention:!!(result.state?.whisper||local.whisper),reason:result.state?.whisper?result.state.reason:local.reason};
   if(!result.state?.whisper&&local.whisper)coachSource='elevenlabs_agent+local_safety_floor';
 }catch(e){warning=e instanceof Error?e.message:'Agent failed';coachSource='local_fallback';}}
 const latencyMs=Date.now()-started;
 if(events.length&&body.sessionId)await appendAgentEvents(body.sessionId,events);
 const trace=await emitPrismTrace({model:coachSource==='elevenlabs_agent'?elevenModel():'binder-local-playbook',inputMessages:[{role:'user',content:JSON.stringify({account,broker,turns:body.turns})}],outputMessage:JSON.stringify(state),latencyMs,sessionId:body.sessionId,agentId:'binder-live-coach',agentName:'Binder Live Coach',metadata:{coachSource,synthetic:body.synthetic,tool_events:events,warning}});
 return Response.json({...state,accountHint:account?`${account.name} · ${account.decisionMaker||'Decision maker unknown'} · ${account.notes}`:null,latencyMs,coachSource,warning,agentEvents:events,prismConfigured:prismConfigured(),prismStatus:trace.status});
 }catch(e){return apiError(e);}}
