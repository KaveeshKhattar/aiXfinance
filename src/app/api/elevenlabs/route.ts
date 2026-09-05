import {closeAgent,elevenConfigured,elevenFetch,ensureAgent} from '@/lib/elevenlabs';
import {apiError,sameOrigin} from '@/lib/validation';
export const runtime='nodejs';
export async function GET(){return Response.json({configured:elevenConfigured()});}
export async function POST(req:Request){try{sameOrigin(req);const body=await req.json();
 if(body.action==='setup')return Response.json({agentId:await ensureAgent()});
 if(body.action==='scribe-token')return Response.json(await (await elevenFetch('/single-use-token/realtime_scribe',{method:'POST'})).json());
 if(body.action==='close'&&typeof body.sessionId==='string'){await closeAgent(body.sessionId);return Response.json({closed:true});}
 return Response.json({error:'Unknown action'},{status:400});
 }catch(e){return apiError(e);}}
