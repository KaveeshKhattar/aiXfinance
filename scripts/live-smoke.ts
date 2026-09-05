import {ensureAgent,runAgent,closeAgent,elevenFetch} from '../src/lib/elevenlabs';
import {ACCOUNTS,BROKERS} from '../src/lib/seed';
import WebSocket from 'ws';
async function main(){
 if(!process.env.ELEVENLABS_API_KEY)throw Error('ElevenLabs key missing');
 const id='smoke-'+Date.now();
 try{
 console.log('Checking agent configuration…');await ensureAgent();console.log('Agent created or reused.');
 const turns=[{speaker:'gatekeeper' as const,text:'What is this regarding?',atMs:0}];
 const r=await runAgent(id,'coach',turns,ACCOUNTS[0],BROKERS[1],['Tuesday at 10 AM']);
 if(!r.state?.whisper||!r.events.some(e=>e.tool==='publish_guidance')){console.log('Agent diagnostic:',JSON.stringify(r));throw Error('No tool-selected coaching response');}
 console.log('PASS real agent tool use:',r.events.map(e=>e.tool).join(', '));
 const d=await runAgent(id,'debrief',turns,ACCOUNTS[0],BROKERS[1]);
 if(!d.debrief)throw Error('No debrief');console.log('PASS real agent debrief:',d.debrief.outcome);
 }finally{await closeAgent(id);}
 console.log('Checking speech generation and streaming transcription…');
 const audio=await elevenFetch('/text-to-speech/JBFqnCBsd6RMkjVDRZzb?output_format=pcm_16000',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'Hello. What is this regarding?',model_id:'eleven_flash_v2_5'})});
 const pcm=Buffer.from(await audio.arrayBuffer());if(pcm.length<1000)throw Error('Empty voice output');console.log('PASS voice generation:',pcm.length,'PCM bytes');
 const token=await (await elevenFetch('/single-use-token/realtime_scribe',{method:'POST'})).json();
 await new Promise<void>((resolve,reject)=>{const ws=new WebSocket('wss://api.elevenlabs.io/v1/speech-to-text/realtime?'+new URLSearchParams({token:token.token,model_id:'scribe_v2_realtime',audio_format:'pcm_16000',commit_strategy:'manual'}));const timer=setTimeout(()=>{ws.close();reject(Error('Transcription timeout'));},20000);
 ws.on('message',raw=>{const m=JSON.parse(raw.toString());if(m.message_type==='session_started')ws.send(JSON.stringify({message_type:'input_audio_chunk',audio_base_64:Buffer.concat([pcm,Buffer.alloc(16000)]).toString('base64'),sample_rate:16000,commit:true}));if(m.message_type==='committed_transcript'&&m.text){clearTimeout(timer);console.log('PASS real speech transcription:',m.text);ws.close();resolve();}if(m.error){clearTimeout(timer);ws.close();reject(Error(String(m.error)));}});ws.on('error',e=>{clearTimeout(timer);reject(e);});});
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
