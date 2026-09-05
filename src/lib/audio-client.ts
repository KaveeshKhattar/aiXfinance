export type Capture={stop:()=>Promise<void>};
export async function startScribe(stream:MediaStream,onText:(text:string)=>void,onPartial:(text:string)=>void,onError:(message:string)=>void):Promise<Capture>{
 const context=new AudioContext({sampleRate:16000});let socket:WebSocket|undefined,node:AudioWorkletNode|undefined;let stopped=false;
 const stop=async()=>{if(stopped)return;stopped=true;node?.disconnect();socket?.close();stream.getTracks().forEach(t=>t.stop());await context.close();};
 try{
 const response=await fetch('/api/elevenlabs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'scribe-token'})});const data=await response.json();if(!response.ok)throw Error(data.error);
 await context.audioWorklet.addModule('/pcm-worklet.js');
 socket=new WebSocket('wss://api.elevenlabs.io/v1/speech-to-text/realtime?'+new URLSearchParams({token:data.token,model_id:'scribe_v2_realtime',audio_format:'pcm_16000',commit_strategy:'vad',vad_silence_threshold_secs:'0.7',language_code:'en'}));
 await new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Speech connection timed out')),15000);
 socket!.onopen=()=>{};
 socket!.onmessage=event=>{try{const d=JSON.parse(event.data);if(d.message_type==='session_started'){clearTimeout(timeout);resolve();}else if(d.message_type==='partial_transcript')onPartial(d.text);else if(d.message_type==='committed_transcript'&&d.text?.trim()){onPartial('');onText(d.text.trim());}else if(d.error){clearTimeout(timeout);reject(Error(String(d.error)));onError(String(d.error));void stop();}}catch{onError('Invalid transcription event');}};
 socket!.onerror=()=>{clearTimeout(timeout);reject(Error('Speech connection failed'));onError('Speech connection failed');void stop();};
 socket!.onclose=()=>{clearTimeout(timeout);reject(Error('Speech connection closed'));if(!stopped){onError('Speech disconnected. End this call or restart capture.');void stop();}};
 });
 node=new AudioWorkletNode(context,'pcm-processor');const source=context.createMediaStreamSource(stream);source.connect(node);const silent=context.createGain();silent.gain.value=0;node.connect(silent);silent.connect(context.destination);
 node.port.onmessage=event=>{if(socket?.readyState!==WebSocket.OPEN)return;const bytes=new Uint8Array(event.data);let binary='';for(const b of bytes)binary+=String.fromCharCode(b);socket.send(JSON.stringify({message_type:'input_audio_chunk',audio_base_64:btoa(binary),sample_rate:16000}));};
 await context.resume();return {stop};
 }catch(e){await stop();throw e;}
}
export class VoicePlayer{
 private audio:HTMLAudioElement|null=null;private abort:AbortController|null=null;private cancel:()=>void=()=>{};private cache=new Map<string,Blob>();
 stop(){this.abort?.abort();this.audio?.pause();this.cancel();this.audio=null;}
 async say(text:string,speaker:'broker'|'prospect'|'coach'='coach'){
  this.stop();const controller=new AbortController();this.abort=controller;const key=speaker+text;let blob=this.cache.get(key);
  if(!blob){const res=await fetch('/api/voice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,speaker}),signal:controller.signal});if(!res.ok){const data=await res.json();throw Error(data.error||'Voice generation failed');}blob=await res.blob();if(this.cache.size>60)this.cache.clear();this.cache.set(key,blob);}
  if(controller.signal.aborted)return;
  const url=URL.createObjectURL(blob);const audio=new Audio(url);this.audio=audio;
  try{await new Promise<void>((resolve,reject)=>{this.cancel=resolve;audio.onended=()=>resolve();audio.onerror=()=>reject(Error('Audio playback failed'));void audio.play().catch(reject);});}finally{URL.revokeObjectURL(url);this.cancel=()=>{};}
 }
}
