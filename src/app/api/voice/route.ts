import {elevenFetch} from '@/lib/elevenlabs';
import {apiError,sameOrigin} from '@/lib/validation';
import {z} from 'zod';
export const runtime='nodejs';
const schema=z.object({text:z.string().trim().min(1).max(1500),speaker:z.enum(['broker','prospect','coach']).default('coach')});
export async function POST(req:Request){try{sameOrigin(req);const b=schema.parse(await req.json());
 const voice=b.speaker==='broker'?(process.env.ELEVENLABS_BROKER_VOICE_ID||'pNInz6obpgDQGcFmaJgB'):(process.env.ELEVENLABS_VOICE_ID||'JBFqnCBsd6RMkjVDRZzb');
 const upstream=await elevenFetch(`/text-to-speech/${encodeURIComponent(voice)}/stream?output_format=mp3_44100_128`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:b.text,model_id:'eleven_flash_v2_5',voice_settings:{stability:0.5,similarity_boost:0.75}}),signal:req.signal});
 return new Response(upstream.body,{headers:{'Content-Type':'audio/mpeg','Cache-Control':'no-store'}});
 }catch(e){return apiError(e);}}
