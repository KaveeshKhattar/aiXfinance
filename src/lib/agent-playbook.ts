import {lineForObjection,discoveryLine,closeLine} from './playbook';
import type {Account,BrokerProfile,ObjectionCode} from './types';
const codes:ObjectionCode[]=['what_regarding','send_email','who_trying_to_reach','all_set','happy_with_broker','no_time','not_interested','call_back_later','already_renewed','send_info','bad_timing','price_shopping'];
export function agentPlaybook(account?:Account|null,broker?:BrokerProfile|null,slots:string[]=[]){
 return [...codes.map(id=>({id,text:lineForObjection(id,account,broker)})),
 {id:'discovery',text:discoveryLine(account)},
 {id:'close',text:closeLine(account)},
 {id:'stop',text:'Understood. Thank you for your time.'},
 {id:'listen',text:'Stop selling. Let them answer.'},
 {id:'confirmed',text:'Great. What email should I use for the invitation?'},
 {id:'clarify',text:'Is that because you recently reviewed things, or because now is not a good time?'},
 ...slots.map((s,i)=>({id:`slot_${i}`,text:`Would ${s} work for a brief meeting?`}))];
}
