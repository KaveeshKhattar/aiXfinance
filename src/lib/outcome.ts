import type {CallOutcome,Turn} from './types';
import {normalize} from './normalize';
export function meetingEvidence(turns:Turn[]):number|null{
 let proposal=false;
 for(let i=0;i<turns.length;i++){
  const n=normalize(turns[i].text);
  if(turns[i].speaker==='broker'){proposal=/meet|call|calendar|minutes/.test(n)&&/monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}/.test(n);continue;}
  if(/might|could|maybe|not sure|cannot|can't|won't|doesn't|does not|don't|do not|not work|no thanks|not interested/.test(n))continue;
  const accepted=/\byes\b|\bagreed\b|\bconfirmed\b|\bworks\b|let's do|lets do|book it|send.*(invite|calendar)/.test(n);
  if(accepted&&(proposal||/\b(monday|tuesday|wednesday|thursday|friday)\b.*\b(at|am|pm|\d)\b/.test(n)))return i;
 }
 return null;
}
export function callOutcome(turns:Turn[]):CallOutcome{
 const last=[...turns].reverse().find(t=>t.speaker!=='broker');
 if(last&&/stop calling|do not call|remove me|not interested|cancel the meeting/i.test(last.text))return 'no_meeting';
 if(meetingEvidence(turns)!==null)return 'meeting_booked';
 const p=turns.filter(t=>t.speaker!=='broker').map(t=>normalize(t.text)).join(' ');
 if(/call me|call back|try me|try.*morning/.test(p))return 'callback';
 if(/send.*(email|info|information)|email me/.test(p))return 'email_promised';
 if(turns.some(t=>t.speaker==='decision_maker'))return 'no_meeting';
 if(turns.some(t=>t.speaker==='gatekeeper'))return 'gatekeeper_block';
 return 'in_progress';
}
