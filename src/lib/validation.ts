import { z } from 'zod';
export const turnSchema=z.object({speaker:z.enum(['broker','gatekeeper','decision_maker','unknown']),text:z.string().trim().min(1).max(5000),atMs:z.number().finite().nonnegative()});
export const requestSchema=z.object({accountId:z.string().max(100).optional(),brokerId:z.string().max(100).optional(),sessionId:z.string().regex(/^[\w-]+$/).max(150).optional(),turns:z.array(turnSchema).min(1).max(500),useAgent:z.boolean().optional(),synthetic:z.boolean().optional(),meetingSlots:z.array(z.string().max(100)).max(5).optional(),coachingLevel:z.enum(['beginner','standard','expert']).optional()});
export const outcomeSchema=z.enum(['meeting_booked','callback','email_promised','no_meeting','gatekeeper_block','in_progress']);
export const stageSchema=z.enum(['intro','gatekeeper','discovery','objection','close']);
export const debriefSchema=z.object({whatHappened:z.string().max(2000),outcome:outcomeSchema,whatWorked:z.string().max(1500),whatDidnt:z.string().max(1500),oneThingToImprove:z.string().max(1000),crm:z.object({account:z.string().max(200),contact:z.string().max(200).nullable(),stage:stageSchema,outcome:outcomeSchema,nextStep:z.string().max(1000),renewal:z.string().max(200).nullable(),objections:z.array(z.string().max(200)).max(30),notes:z.string().max(2000)}),evidence:z.array(z.object({turn:z.number().int().nonnegative(),quote:z.string().max(1000)})).max(20).default([])});
export function sameOrigin(req:Request){
 const origin=req.headers.get('origin');
 if(!origin)return;
 let parsed:URL;
 try{parsed=new URL(origin);}catch{throw Error('Cross-origin request rejected');}
 const requestUrl=new URL(req.url);
 // Allow loopback (local dev on any port)
 const loopback=(parsed.hostname==='localhost'||parsed.hostname==='127.0.0.1'||parsed.hostname==='[::1]')
   && (parsed.protocol==='http:'||parsed.protocol==='https:');
 const requestLoopback=requestUrl.hostname==='localhost'||requestUrl.hostname==='127.0.0.1'||requestUrl.hostname==='[::1]';
 if(loopback&&requestLoopback&&parsed.port===requestUrl.port)return;
 // Allow same host in production (e.g. Vercel deployment)
 if(parsed.hostname===requestUrl.hostname&&parsed.protocol===requestUrl.protocol)return;
 throw Error('Cross-origin request rejected');
}
export function apiError(error:unknown){const validation=error instanceof z.ZodError;return Response.json({error:validation?'Invalid input. Check transcript and required fields.':error instanceof Error?error.message:'Request failed'},{status:validation?400:503});}
