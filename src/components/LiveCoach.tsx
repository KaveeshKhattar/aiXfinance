"use client";
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {SCENARIOS,ACCOUNTS,BROKERS} from '@/lib/seed';
import {coachTurn} from '@/lib/coach-engine';
import {startScribe,VoicePlayer,type Capture} from '@/lib/audio-client';
import type {Account,AgentEvent,ConversationState,Debrief,SpeakerRole,Turn} from '@/lib/types';

type Mode='idle'|'replay'|'mic'|'typed'|'finishing'|'done';
type Remote=ConversationState & {coachSource:string;warning?:string;agentEvents?:AgentEvent[];latencyMs:number;prismStatus:string};
async function api(url:string,body?:unknown){const r=await fetch(url,body===undefined?undefined:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error||'Request failed');return d;}
export function LiveCoach(){
 const [mode,setMode]=useState<Mode>('idle'),[scenarioId,setScenarioId]=useState(SCENARIOS[0].id),[accountId,setAccountId]=useState('acme'),[brokerId,setBrokerId]=useState('priya');
 const [accounts,setAccounts]=useState<Account[]>(ACCOUNTS),[configured,setConfigured]=useState(false),[useAgent,setUseAgent]=useState(true),[voiceReplay,setVoiceReplay]=useState(true),[spoken,setSpoken]=useState(false),[captureMode,setCaptureMode]=useState('microphone');
 const [speaker,setSpeaker]=useState<SpeakerRole>('unknown'),[coachingLevel,setCoachingLevel]=useState<'beginner'|'standard'|'expert'>('standard'),[slots,setSlots]=useState('Tuesday at 10 AM; Thursday at 2 PM'),[turns,setTurns]=useState<Turn[]>([]),[state,setState]=useState<Remote|null>(null),[events,setEvents]=useState<AgentEvent[]>([]),[partial,setPartial]=useState(''),[input,setInput]=useState(''),[error,setError]=useState(''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[debrief,setDebrief]=useState<Debrief|null>(null),[callId,setCallId]=useState<string|null>(null),[seconds,setSeconds]=useState(0),[setupBusy,setSetupBusy]=useState(false);
 const session=useRef(''),history=useRef<Turn[]>([]),captures=useRef<Capture[]>([]),player=useRef<VoicePlayer|null>(null),generation=useRef(0),processing=useRef<Promise<void>>(Promise.resolve()),active=useRef(false),started=useRef(0),speakerRef=useRef(speaker),settings=useRef({accountId,brokerId,useAgent,slots,coachingLevel,synthetic:false}),spokenRef=useRef(spoken),lastSpoken=useRef(''),accepted=useRef(false);
 useEffect(()=>{speakerRef.current=speaker;spokenRef.current=spoken;},[speaker,spoken]);
 const scenario=SCENARIOS.find(s=>s.id===scenarioId)!;const account=accounts.find(a=>a.id===accountId);
 useEffect(()=>{player.current=new VoicePlayer();void Promise.all([api('/api/meta'),api('/api/accounts')]).then(([m,a])=>{setConfigured(m.elevenlabs);setAccounts(a.accounts);}).catch(e=>setError(e.message));
 return()=>{generation.current++;active.current=false;captures.current.forEach(c=>void c.stop());player.current?.stop();if(session.current)void fetch('/api/elevenlabs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'close',sessionId:session.current}),keepalive:true});};},[]);
 useEffect(()=>{if(!['replay','mic','typed'].includes(mode))return;const timer=setInterval(()=>setSeconds(Math.floor((Date.now()-started.current)/1000)),1000);return()=>clearInterval(timer);},[mode]);
 const stopCapture=async()=>{const old=captures.current;captures.current=[];await Promise.all(old.map(c=>c.stop()));setPartial('');};
 const begin=(nextMode:Mode,synthetic:boolean)=>{generation.current++;session.current=crypto.randomUUID();history.current=[];processing.current=Promise.resolve();settings.current={accountId,brokerId,useAgent,slots,coachingLevel,synthetic};active.current=true;accepted.current=true;started.current=Date.now();lastSpoken.current='';setSeconds(0);setTurns([]);setState(null);setEvents([]);setError('');setStatus('Starting…');setDebrief(null);setCallId(null);setMode(nextMode);return generation.current;};
 const append=(text:string,role:SpeakerRole,epoch=generation.current)=>{
  if(!accepted.current||!text.trim()||epoch!==generation.current)return Promise.resolve();
  const turn:Turn={speaker:role,text:text.trim(),atMs:Date.now()-started.current};history.current=[...history.current,turn];const snapshot=[...history.current];setTurns(snapshot);
  // Render the deterministic safety-floor decision immediately. The agent can
  // refine it later, but a network/model round trip must not blank the coach.
  const instant=coachTurn(snapshot,accounts.find(a=>a.id===settings.current.accountId),BROKERS.find(b=>b.id===settings.current.brokerId),coachingLevel);
  setState({...instant,coachSource:'local_safety_floor',latencyMs:0,prismStatus:'pending'} as Remote);
  player.current?.stop();
  processing.current=processing.current.catch(()=>{}).then(async()=>{
   if(epoch!==generation.current)return;setBusy(true);
   try{const s=settings.current;const remote=await api('/api/coach',{accountId:s.accountId,brokerId:s.brokerId,useAgent:s.useAgent,coachingLevel:s.coachingLevel,meetingSlots:s.slots.split(';').map(v=>v.trim()).filter(Boolean),synthetic:s.synthetic,sessionId:session.current,turns:snapshot}) as Remote;
    if(epoch!==generation.current)return;setEvents(prev=>[...prev,...(remote.agentEvents||[])]);
    if(snapshot.length===history.current.length){setState(remote);setStatus(`${remote.coachSource.replaceAll('_',' ')} · ${remote.latencyMs} ms · PRISM ${remote.prismStatus}`);if(remote.warning)setError(remote.warning);
     if(spokenRef.current&&remote.whisper&&remote.whisper!==lastSpoken.current){lastSpoken.current=remote.whisper;void player.current?.say(remote.whisper).catch(e=>{if(e.name!=='AbortError')setError(e.message);});}}
   }catch(e){if(epoch===generation.current)setError(e instanceof Error?e.message:'Coaching request failed');}finally{if(epoch===generation.current)setBusy(false);}
  });return processing.current;
 };
 const finish=async()=>{
  if(!active.current)return;accepted.current=false;await stopCapture();player.current?.stop();active.current=false;setMode('finishing');setStatus('Finishing pending analysis…');
  const epoch=generation.current;await processing.current;if(epoch!==generation.current)return;
  if(!history.current.length){await api('/api/elevenlabs',{action:'close',sessionId:session.current});setMode('idle');return;}
  try{const s=settings.current;const result=await api('/api/analyze',{accountId:s.accountId,brokerId:s.brokerId,turns:history.current,useAgent:s.useAgent,meetingSlots:s.slots.split(';').map(v=>v.trim()).filter(Boolean),sessionId:session.current,synthetic:s.synthetic});
   if(epoch!==generation.current)return;setDebrief(result.debrief);setCallId(result.call.id);setEvents(result.call.agentEvents||[]);setMode('done');setStatus(result.debrief.source?.replaceAll('_',' ')||'Saved');if(result.debrief.warning)setError(result.debrief.warning);const a=await api('/api/accounts');setAccounts(a.accounts);
  }catch(e){setError(e instanceof Error?e.message:'Debrief failed');setMode('done');}
 };
 const emergency=async()=>{accepted.current=false;active.current=false;generation.current++;await stopCapture();player.current?.stop();void api('/api/elevenlabs',{action:'close',sessionId:session.current}).catch(()=>{});setMode('done');setBusy(false);setStatus('Stopped. Transcript preserved; export it or retry the debrief.');};
 const replay=async()=>{
  const epoch=begin('replay',true);
  try{for(const t of scenario.turns){if(epoch!==generation.current||!active.current)break;
    if(voiceReplay&&configured){setStatus('ElevenLabs replay audio');await player.current!.say(t.text,t.speaker==='broker'?'broker':'prospect');}
    else await new Promise(r=>setTimeout(r,1200));
    if(epoch!==generation.current||!active.current)break;await append(t.text,t.speaker,epoch);
    await new Promise(r=>setTimeout(r,900));
   }
   if(epoch===generation.current&&active.current)await finish();
  }catch(e){if(epoch===generation.current){setError(e instanceof Error?e.message:'Replay failed');await finish();}}
 };
 const mic=async()=>{
  let micStream:MediaStream|undefined,tabStream:MediaStream|undefined;const epoch=begin('mic',false);setStatus('Choose your audio source…');
  try{
   if(captureMode==='both'){tabStream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});if(!tabStream.getAudioTracks().length)throw Error('No call audio shared. Choose a browser tab and enable Share tab audio.');}
   micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
   if(epoch!==generation.current){micStream.getTracks().forEach(t=>t.stop());tabStream?.getTracks().forEach(t=>t.stop());return;}
   const audioError=(message:string)=>{if(epoch===generation.current)setError(message);};
   const micCapture=await startScribe(micStream,text=>{if(epoch===generation.current){setStatus(captureMode==='both'?'Microphone heard you · coaching…':'Heard a turn · coaching…');void append(text,captureMode==='both'?'broker':speakerRef.current,epoch);}},text=>setPartial(text),audioError);captures.current.push(micCapture);
   if(tabStream){const shared=tabStream;const tabCapture=await startScribe(new MediaStream(shared.getAudioTracks()),text=>{if(epoch===generation.current){setStatus('Call tab audio heard · coaching…');void append(text,'unknown',epoch);}},text=>setPartial(text),audioError);captures.current.push({stop:async()=>{await tabCapture.stop();shared.getTracks().forEach(t=>t.stop());}});shared.getVideoTracks()[0].onended=()=>{void finish();};}
   if(epoch!==generation.current){await stopCapture();return;}setStatus(captureMode==='both'?'Listening: microphone = broker, shared tab = prospect':'ElevenLabs Scribe listening · speaker inferred from content unless selected');
  }catch(e){micStream?.getTracks().forEach(t=>t.stop());tabStream?.getTracks().forEach(t=>t.stop());await stopCapture();active.current=false;accepted.current=false;setMode('idle');setError(e instanceof Error?e.message:'Microphone failed');}
 };
 const exportTranscript=()=>{const data={sessionId:session.current,turns:history.current,debrief,agentEvents:events};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='binder-call.json';a.click();URL.revokeObjectURL(url);};
 const setup=async()=>{setSetupBusy(true);setError('');try{await api('/api/elevenlabs',{action:'setup'});setStatus('ElevenLabs agent is ready.');}catch(e){setError(e instanceof Error?e.message:'Setup failed');}finally{setSetupBusy(false);}};
 const live=['replay','mic','typed'].includes(mode);
 return <div className="mx-auto w-full max-w-5xl px-6 py-10">
  <div className="flex justify-between gap-4 items-start"><div><p className="text-[11px] uppercase tracking-[0.26em] text-muted">Binder · ElevenLabs sales coach</p><h1 className="font-serif text-5xl mt-3">{live?'Stay in the conversation.':mode==='done'?'The next call starts here.':'One line. Then silence.'}</h1></div><span className="text-xs border border-line rounded-full px-3 py-2 text-muted">{configured?'ElevenLabs connected':'Key not configured'}</span></div>
  {error&&<div role="alert" className="mt-5 rounded-xl border border-red-400/30 bg-red-400/5 p-4 text-sm text-red-200 flex justify-between gap-4">{error}<button onClick={()=>setError('')} aria-label="Dismiss error">×</button></div>}
  {mode==='idle'&&<div className="grid md:grid-cols-[1.4fr_1fr] gap-8 mt-8"><section>
   <p className="text-muted leading-relaxed">Live voice, account memory, and a tool-using agent focused on earning the meeting. Use headphones for spoken coaching.</p>
   <div className="grid gap-3 mt-6">{SCENARIOS.map(s=><button key={s.id} onClick={()=>{setScenarioId(s.id);setAccountId(s.accountId);setBrokerId(s.brokerId);}} className={`text-left rounded-2xl border p-4 ${scenarioId===s.id?'border-amber/50 bg-amber/5':'border-line'}`}><strong className="text-sm font-normal">{s.title}</strong><p className="text-xs text-muted mt-1">{s.subtitle}</p></button>)}</div>
   <div className="flex flex-wrap gap-3 mt-6"><button disabled={useAgent&&!configured} onClick={()=>void replay()} className="rounded-full bg-fg text-bg px-5 py-3 text-sm">Replay call</button><button disabled={!configured} onClick={()=>void mic()} className="rounded-full border border-amber/40 px-5 py-3 text-sm">Use microphone</button><button disabled={useAgent&&!configured} onClick={()=>begin('typed',false)} className="rounded-full border border-line px-5 py-3 text-sm">Type a call</button></div>
   <p className="text-xs text-muted mt-4">Replay is synthetic. Live microphone and typed calls are saved separately.</p>
  </section><section className="rounded-2xl border border-line p-5 space-y-5">
   <Field label="Account"><select value={accountId} onChange={e=>setAccountId(e.target.value)}>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
   <Field label="Broker"><select value={brokerId} onChange={e=>setBrokerId(e.target.value)}>{BROKERS.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
   <Field label="Coaching level"><select value={coachingLevel} onChange={e=>setCoachingLevel(e.target.value as "beginner"|"standard"|"expert")}><option value="beginner">Beginner · coach every turn</option><option value="standard">Standard · timely interventions</option><option value="expert">Expert · concise interventions</option></select></Field><Field label="Coaching engine"><select value={useAgent?'agent':'local'} onChange={e=>setUseAgent(e.target.value==='agent')}><option value="agent">ElevenLabs agent · metered</option><option value="local">Local rehearsal · no model usage</option></select></Field>
   <Field label="Capture"><select value={captureMode} onChange={e=>setCaptureMode(e.target.value)}><option value="microphone">Microphone / room conversation</option><option value="both">Call tab audio + my microphone</option></select></Field>
   <Field label="Proposed slots · separate with ;"><input value={slots} onChange={e=>setSlots(e.target.value)}/></Field>
   <p className="text-[11px] text-muted">Times are your proposals, not verified calendar availability.</p>
   <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={voiceReplay} onChange={e=>setVoiceReplay(e.target.checked)}/>ElevenLabs replay voices</label>
   <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={spoken} onChange={e=>setSpoken(e.target.checked)}/>Speak coaching through headphones</label>
   <button disabled={!configured||setupBusy} onClick={()=>void setup()} className="text-xs text-amber">{setupBusy?'Configuring agent…':'Initialize / check ElevenLabs agent'}</button>
  </section></div>}
  {(live||mode==='finishing')&&<>
   <div className="flex flex-wrap items-center justify-between gap-3 mt-7 text-xs text-muted"><span><i className="live-dot inline-block h-2 w-2 rounded-full bg-live mr-2"/>{mode==='replay'?'Synthetic replay':'Live session'} · {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')} · {account?.name}</span><div className="flex gap-4"><button onClick={()=>void finish()} disabled={mode==='finishing'}>End & debrief</button><button onClick={()=>void emergency()} className="text-red-300">Stop now</button></div></div>
   <div className="rounded-3xl border border-line mt-6 p-8 sm:p-12 min-h-72 text-center flex flex-col justify-center">
    <p className="text-[10px] uppercase tracking-[0.22em] text-muted">{state?.stage||'intro'} · {(state?.speaker||'unknown').replaceAll('_',' ')} · {state?.objectionKind||'none'} objection</p>
    <p className="font-serif text-3xl sm:text-5xl leading-tight mt-8">{mode==='finishing'?'Preparing your debrief…':state?.whisper|| (busy?'Listening for the next step…':'A good moment to listen.')}</p>
    <p className="text-xs text-muted mt-6">{state?.reason?.replaceAll('_',' ')||'Quiet by default. No unsupported policy facts.'}</p>
   </div><p className="mt-3 text-xs text-muted">{status}</p>
   <div className="rounded-2xl border border-amber/20 bg-amber/5 mt-6 p-4"><p className="text-[10px] uppercase tracking-widest text-amber">Account memory</p><p className="text-sm mt-2">{account?.notes}</p>{!!account?.doNotRepeat.length&&<p className="text-xs text-muted mt-2">Do not repeat: {account.doNotRepeat.join(' · ')}</p>}</div>
   {mode!=='replay'&&<div className="mt-5"><div className="flex flex-wrap gap-4 items-center"><label className="text-xs text-muted">Speaker <select aria-label="Speaker" value={speaker} onChange={e=>setSpeaker(e.target.value as SpeakerRole)} className="ml-2 border border-line p-2 rounded-lg bg-bg"><option value="unknown">Infer from content</option><option value="broker">Broker</option><option value="gatekeeper">Gatekeeper</option><option value="decision_maker">Decision maker</option></select></label><label className="text-xs flex gap-2"><input type="checkbox" checked={spoken} onChange={e=>setSpoken(e.target.checked)}/>Spoken coaching</label></div><p className="text-[11px] text-muted mt-2">Single mic cannot reliably separate people. Select a role or use separate tab audio for better attribution.</p><form className="flex gap-2 mt-3" onSubmit={e=>{e.preventDefault();void append(input,speaker);setInput('');}}><input aria-label="Transcript turn" className="flex-1 min-w-0 border border-line rounded-xl p-3 bg-transparent text-sm" value={input} maxLength={5000} disabled={mode==='finishing'} onChange={e=>setInput(e.target.value)} placeholder="Add or correct what was said…"/><button disabled={!input.trim()||mode==='finishing'} className="rounded-xl bg-fg text-bg px-4 text-sm">Send</button></form></div>}
  </>}
  {mode==='done'&&<section className="mt-8">{debrief?<><p className="text-xs text-muted">{debrief.source?.replaceAll('_',' ')} · {debrief.outcome.replaceAll('_',' ')}</p><dl className="grid sm:grid-cols-2 gap-6 mt-6">{[['What happened',debrief.whatHappened],['What worked',debrief.whatWorked],['What didn’t',debrief.whatDidnt],['One thing to improve',debrief.oneThingToImprove]].map(([k,v])=><div key={k} className="rounded-2xl border border-line p-5"><dt className="text-[10px] uppercase tracking-widest text-muted">{k}</dt><dd className="mt-3 text-lg">{v}</dd></div>)}</dl><details className="mt-5 rounded-xl border border-line p-4"><summary>CRM draft · review before sending</summary><pre className="text-xs whitespace-pre-wrap text-muted mt-3">{JSON.stringify(debrief.crm,null,2)}</pre></details></>:<p className="text-muted">{status||'Call stopped. Transcript remains available below.'}</p>}
   <div className="flex gap-3 mt-7"><button onClick={()=>setMode('idle')} className="rounded-full bg-fg text-bg px-5 py-2.5 text-sm">New call</button><button onClick={exportTranscript} className="rounded-full border border-line px-5 py-2.5 text-sm">Export transcript & CRM</button>{callId&&<Link className="rounded-full border border-line px-5 py-2.5 text-sm" href={`/debriefs/${callId}`}>Open record</Link>}{!debrief&&turns.length>0&&<button onClick={()=>{active.current=true;void finish();}} className="text-sm text-amber">Retry debrief</button>}</div>
  </section>}
  {(turns.length>0||partial)&&<section className="mt-8 rounded-2xl border border-line p-5"><h2 className="text-xs text-muted uppercase tracking-widest">Transcript</h2><div className="max-h-64 overflow-y-auto mt-4 space-y-3">{turns.map((t,i)=><p key={i} className="text-sm"><span className="text-[10px] text-muted uppercase mr-3">{t.speaker.replaceAll('_',' ')}</span>{t.text}</p>)}{partial&&<p className="text-sm italic text-muted">{partial}…</p>}</div></section>}
  {events.length>0&&<details className="mt-5 rounded-2xl border border-line p-5"><summary className="text-xs text-amber cursor-pointer">Agent activity · {events.length} real tool calls</summary><div className="mt-4 space-y-3">{events.map((e,i)=><div key={i} className="border-t border-line pt-3"><strong className="text-xs font-mono">{e.tool}</strong><pre className="text-[11px] text-muted whitespace-pre-wrap mt-2">{JSON.stringify(e.output,null,2)}</pre></div>)}</div></details>}
  {mode==='idle'&&status&&<p className="text-sm text-muted mt-5">{status}</p>}
 </div>;
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block"><span className="block text-[10px] uppercase tracking-widest text-muted mb-2">{label}</span><span className="[&>select]:w-full [&>input]:w-full [&>select]:bg-bg [&>input]:bg-bg [&>select]:border [&>input]:border [&>select]:border-line [&>input]:border-line [&>select]:rounded-lg [&>input]:rounded-lg [&>select]:p-2 [&>input]:p-2 [&>select]:text-xs [&>input]:text-xs">{children}</span></label>;}


