import {defineModule, field, fail} from '@loft-studio/sdk';
export {Booking, bookingDefaults, validateBookingSettings, localEpoch, localParts} from './engine.mjs';
import {bookingDefaults} from './engine.mjs';

// Compatibility storage port: existing operational IDs and tables stay authoritative.
export function ensureBookingSite(store, site) {
  store.run('INSERT OR IGNORE INTO sites VALUES (?,?)', site.id, JSON.stringify({id:site.id, name:site.name, adapter:'studio-operations', studioSite:site.id}));
  const config = {...bookingDefaults(), participantMode:'generic'};
  config.services = config.services.map((s,i) => ({...s, id:i?'appointment':'overnight', name:i?'Randevu':'Konaklama', resource:i?'appointments':'rooms', enabled:false}));
  store.run('INSERT OR IGNORE INTO booking_settings VALUES (?,0,?)', site.id, JSON.stringify(config));
}
export function createBookingModule({booking, store}) {
  return defineModule({
    manifest:{id:'studio.booking', name:'Randevu ve konaklama', description:'Zaman, kapasite, katılımcı ve takvim yönetimi. Mevcut ziyaretçi rezervasyon akışı korunur.', version:'1.0.0', apiVersion:1, schemaVersion:1, permissions:['operations']},
    collections:{}, migrations:[{version:1, up(){}}],
    onInstall(ctx){ensureBookingSite(store, ctx.site);},
    exportData(ctx){return {settings:booking.settings(ctx.site.id), bookings:booking.list(ctx.site.id), calendar:booking.events(ctx.site.id)};},
    commands:{
      list:{label:'Rezervasyonları listele', permission:'operations', write:false, run:ctx => ({bookings:booking.list(ctx.site.id)})},
      settings:{label:'Hizmetleri ve ayarları göster', permission:'operations', write:false, run:ctx => booking.settings(ctx.site.id)},
      calendar:{label:'Takvimi göster', permission:'operations', write:false, run:ctx => ({events:booking.events(ctx.site.id), ics:booking.ics(ctx.site.id)})},
      availability:{label:'Müsaitliği sorgula', permission:'operations', write:false,
        fields:{serviceId:field('Hizmet kimliği','text',{required:true,maxLength:60}), date:field('Randevu günü','date'), startDate:field('Giriş günü','date'), endDate:field('Çıkış günü','date'), quantity:field('Katılımcı sayısı','number',{required:true,min:1,max:1000,default:1})},
        run:(ctx,input)=>booking.availability(ctx.site.id,input)},
      create:{label:'Rezervasyon oluştur',permission:'operations',
        fields:{requestId:field('Tekil istek anahtarı','text',{required:true,maxLength:36,generate:'uuid'}),serviceId:field('Hizmet kimliği','text',{required:true,maxLength:60}), start:field('Randevu başlangıcı (yerel YYYY-MM-DDTHH:mm)','text',{maxLength:16}), startDate:field('Konaklama girişi','date'), endDate:field('Konaklama çıkışı','date'), name:field('Müşteri adı','text',{required:true,maxLength:120}),email:field('E-posta','email',{required:true,maxLength:254}),phone:field('Telefon','text',{required:true,maxLength:40}),notes:field('Not','textarea',{maxLength:3000}),consent:field('Müşteri veri işleme onayı alındı','boolean',{required:true}),participants:field('Katılımcılar','items',{required:true,minItems:1,maxItems:20,fields:{name:field('Ad','text',{required:true,maxLength:80}),notes:field('Not','textarea',{maxLength:1500})}})},
        run(ctx,input){if(booking.settings(ctx.site.id).values.participantMode!=='generic')fail(422,'Pet uzantısı için mevcut rezervasyon ekranını kullanın.');return booking.create(ctx.site.id,{...input,customer:{name:input.name,email:input.email,phone:input.phone},quantity:input.participants.length},ctx.actor.user_id);}},
      updateStatus:{label:'Rezervasyon durumunu değiştir',permission:'operations',fields:{id:field('Rezervasyon kimliği','text',{required:true,maxLength:80}),revision:field('Güncel sürüm','number',{required:true,min:0}),status:field('Durum','enum',{required:true,values:['confirmed','checked_in','completed','cancelled','no_show']})},run:(ctx,input)=>booking.update(ctx.site.id,input.id,input,ctx.actor.user_id)}
    }
  });
}
