import legacy from './index.mjs';
import {defineIntegration,fail} from '@loft-studio/sdk';
const label=b=>b.reference+' · '+b.customerName+' · '+b.status;
export default defineIntegration({...legacy,apiVersion:2,
 subscriptions:[{...legacy.subscriptions[0],async run(ctx,event){
  const old=await ctx.records.get('bookings',event.data.bookingId);
  if(!old||old.data.bookingRevision<event.data.bookingRevision)await ctx.records.put('bookings',{id:event.data.bookingId,revision:old?.revision??-1,data:event.data});
  const id=event.data.bookingId+'_'+event.data.bookingRevision;
  if(!await ctx.records.get('timeline',id))await ctx.records.put('timeline',{id,data:{...event.data,occurredAt:event.occurredAt}});
 }}],
 commands:{
  timeline:{...legacy.commands.timeline,async run(ctx,input){
   await ctx.modules.get('studio.crm','contacts',input.contactId);
   const page=await ctx.records.list('links',{where:{contactId:input.contactId},offset:input.bookingOffset,limit:100});
   const links=[];for(const r of page.items)links.push({id:r.id,revision:r.revision,label:label((await ctx.records.get('bookings',r.id)).data)});
   const events=links.length?await ctx.records.list('timeline',{where:{bookingId:links.map(r=>r.id)},offset:input.offset,limit:50,orderBy:'occurredAt'}):{items:[],total:0};
   const candidates=[];for(const r of (await ctx.records.list('bookings',{search:input.search,limit:100})).items)if(!await ctx.records.get('links',r.id))candidates.push({id:r.id,label:label(r.data)});
   return {links,linkTotal:page.total,bookingOffset:input.bookingOffset,items:events.items.map(e=>({id:e.id,title:e.data.kind==='baseline'?'Mevcut rezervasyon kaydı':e.data.kind==='created'?'Rezervasyon oluşturuldu':'Rezervasyon güncellendi',detail:label(e.data),time:e.data.occurredAt,bookingId:e.data.bookingId,revision:e.data.bookingRevision,start:e.data.start,end:e.data.end})),total:events.total,offset:input.offset,candidates,help:'Rezervasyonu ilgili kişiye seçerek bağlayın. E-posta eşleşmesi kişileri otomatik birleştirmez.'};
  }},
  link:{...legacy.commands.link,async run(ctx,input){
   await ctx.modules.get('studio.crm','contacts',input.contactId);
   if(!await ctx.records.get('bookings',input.bookingId))fail(404,'Rezervasyon henüz aktarılmadı veya bu siteye ait değil.');
   const old=await ctx.records.get('links',input.bookingId);if(old){if(old.data.contactId===input.contactId)return old;fail(409,'Rezervasyon başka bir kişiye bağlı.');}
   const record=await ctx.records.put('links',{id:input.bookingId,data:{...input,linkedAt:new Date().toISOString(),linkedBy:ctx.actor.user_id}});
   await ctx.audit('booking-crm.linked',input);return record;
  }},
  unlink:{...legacy.commands.unlink,async run(ctx,input){
   await ctx.modules.get('studio.crm','contacts',input.contactId);const old=await ctx.records.get('links',input.bookingId);
   if(!old||old.data.contactId!==input.contactId)fail(404,'Bağlantı bulunamadı.');
   await ctx.records.remove('links',input.bookingId,input.revision);await ctx.audit('booking-crm.unlinked',{bookingId:input.bookingId,contactId:input.contactId});return {ok:true};
  }}
 }
});
