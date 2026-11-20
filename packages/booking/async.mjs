import {defineAsyncModule,fail} from '@loft-studio/sdk';
import {createBookingModule,ensureBookingSite} from './index.mjs';

/** Operational data stays in its authoritative store; no distributed rollback. */
export function createAsyncBookingModule({booking,store}) {
 const legacy=createBookingModule({booking,store});
 const module=defineAsyncModule({
  manifest:{...legacy.manifest,apiVersion:2},collections:{},migrations:legacy.migrations,
  events:legacy.events,ports:['booking.operations'],
  commands:Object.fromEntries(Object.entries(legacy.commands).map(([name,c])=>[name,{...c,port:'booking.operations',run:async(_ctx,input)=>({operation:name,input})}]))
 });
 return {module,
  async provision(site){if(booking.provision){store.run('INSERT OR IGNORE INTO sites VALUES (?,?)',site.id,JSON.stringify({id:site.id,name:site.name,adapter:'studio-operations',studioSite:site.id}));await booking.provision(site);}else ensureBookingSite(store,site);},
  async invoke({actor,site},{operation,input}){
   if(!booking.provision)ensureBookingSite(store,site);
   if(operation==='list')return{bookings:await booking.list(site.id)};
   if(operation==='settings')return booking.settings(site.id);
   if(operation==='calendar')return{events:await booking.events(site.id),ics:await booking.ics(site.id)};
   if(operation==='availability')return booking.availability(site.id,input);
   if(operation==='updateStatus')return booking.update(site.id,input.id,input,actor.user_id);
   if(operation==='create'){
    if((await booking.settings(site.id)).values.participantMode!=='generic')fail(422,'Pet uzantısı için mevcut rezervasyon ekranını kullanın.');
    return booking.create(site.id,{...input,customer:{name:input.name,email:input.email,phone:input.phone},quantity:input.participants.length},actor.user_id);
   }fail(404,'Rezervasyon işlemi bulunamadı.');
  },
  source:{async read(after,limit){return booking.provision?booking.store.changes(after,limit):legacy.eventSource.read(after,limit);}},
  async exportData({site}){return{settings:await booking.settings(site.id),bookings:await booking.list(site.id),calendar:await booking.events(site.id)};}
 };
}
