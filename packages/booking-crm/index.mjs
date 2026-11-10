import {defineIntegration,field,fail} from '@loft-studio/sdk';
import {bookingEventFields} from '@loft-studio/booking/events';
const contactId=field('CRM kişisi','reference',{required:true,collection:'contacts',module:'studio.crm'});
const bookingId=field('Rezervasyon','text',{required:true,maxLength:80});
const statuses={pending:'Onay bekliyor',confirmed:'Onaylandı',checked_in:'Giriş yapıldı',completed:'Tamamlandı',cancelled:'İptal edildi',no_show:'Gelmedi'};
const label=b=>b.reference+' · '+b.customerName+' · '+statuses[b.status];
const timelineEntry=e=>({id:e.id,title:e.data.kind==='baseline'?'Mevcut rezervasyon kaydı':e.data.kind==='created'?'Rezervasyon oluşturuldu':'Rezervasyon güncellendi',detail:e.data.reference+' · '+statuses[e.data.status],time:e.data.occurredAt,bookingId:e.data.bookingId,revision:e.data.bookingRevision,start:e.data.start,end:e.data.end});
export default defineIntegration({
  id:'studio.booking-crm',name:'Rezervasyon–CRM',version:'1.0.0',
  requires:{'studio.booking':1,'studio.crm':1},permissions:['operations'],
  collections:{
    bookings:{fields:bookingEventFields},
    timeline:{fields:{...bookingEventFields,occurredAt:field('Olay zamanı','text',{required:true,maxLength:40})}},
    links:{fields:{bookingId,contactId,linkedAt:field('Bağlantı zamanı','text',{required:true,maxLength:40}),linkedBy:field('Bağlayan kullanıcı','text',{required:true,maxLength:80})}}
  },
  subscriptions:[{module:'studio.booking',type:'booking.changed',version:1,run(ctx,event){
    const old=ctx.records.get('bookings',event.data.bookingId);
    if(!old||old.data.bookingRevision<event.data.bookingRevision)ctx.records.put('bookings',{id:event.data.bookingId,revision:old?.revision??-1,data:event.data});
    // Stable domain revision also deduplicates administrative replay.
    const id=event.data.bookingId+'_'+event.data.bookingRevision;
    if(!ctx.records.get('timeline',id))ctx.records.put('timeline',{id,data:{...event.data,occurredAt:event.occurredAt}});
  }}],
  views:[{id:'reservations',label:'Rezervasyon hareketleri',module:'studio.crm',collection:'contacts',kind:'relatedTimeline',command:'timeline',contextField:'contactId',linkCommand:'link',unlinkCommand:'unlink',linkField:'bookingId'}],
  commands:{
    timeline:{write:false,fields:{contactId,search:field('Rezervasyonlarda ara','text',{maxLength:200}),offset:field('Hareket sayfası','number',{min:0,default:0}),bookingOffset:field('Bağlantı sayfası','number',{min:0,default:0})},run(ctx,input){
      ctx.modules.get('studio.crm','contacts',input.contactId);
      const page=ctx.records.list('links',{where:{contactId:input.contactId},offset:input.bookingOffset,limit:100});
      const links=page.items.map(r=>({id:r.id,revision:r.revision,label:label(ctx.records.get('bookings',r.id).data)}));
      const events=links.length?ctx.records.list('timeline',{where:{bookingId:links.map(r=>r.id)},offset:input.offset,limit:50,orderBy:'occurredAt'}):{items:[],total:0};
      const candidates=ctx.records.list('bookings',{search:input.search,limit:100}).items.filter(r=>!ctx.records.get('links',r.id)).map(r=>({id:r.id,label:label(r.data)}));
      return {links,linkTotal:page.total,bookingOffset:input.bookingOffset,items:events.items.map(timelineEntry),total:events.total,offset:input.offset,candidates,
        help:'Rezervasyonu ilgili kişiye seçerek bağlayın. E-posta eşleşmesi kişileri otomatik birleştirmez. Arama en son 100 eşleşen rezervasyonu tarar.'};
    }},
    link:{fields:{contactId,bookingId},run(ctx,input){
      ctx.modules.get('studio.crm','contacts',input.contactId);
      if(!ctx.records.get('bookings',input.bookingId))fail(404,'Rezervasyon henüz aktarılmadı veya bu siteye ait değil.');
      const old=ctx.records.get('links',input.bookingId);
      if(old){if(old.data.contactId===input.contactId)return old;fail(409,'Rezervasyon başka bir kişiye bağlı. Önce mevcut bağlantıyı kaldırın.');}
      const record=ctx.records.put('links',{id:input.bookingId,data:{...input,linkedAt:new Date().toISOString(),linkedBy:ctx.actor.user_id}});
      ctx.audit('booking-crm.linked',{bookingId:input.bookingId,contactId:input.contactId});
      return record;
    }},
    unlink:{fields:{contactId,bookingId,revision:field('Bağlantı sürümü','number',{required:true,min:0})},run(ctx,input){
      ctx.modules.get('studio.crm','contacts',input.contactId);
      const old=ctx.records.get('links',input.bookingId);
      if(!old||old.data.contactId!==input.contactId)fail(404,'Bağlantı bulunamadı.');
      ctx.records.remove('links',input.bookingId,input.revision);
      ctx.audit('booking-crm.unlinked',{bookingId:input.bookingId,contactId:input.contactId});
      return {ok:true};
    }}
  }
});
