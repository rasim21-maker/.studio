import {field} from '@loft-studio/sdk';
export const bookingEventFields = {
  bookingId:field('Rezervasyon','text',{required:true,maxLength:80}),
  bookingRevision:field('Sürüm','number',{required:true,min:0}),
  reference:field('Referans','text',{required:true,maxLength:40}),
  customerName:field('Müşteri','text',{required:true,maxLength:120}),
  serviceId:field('Hizmet','text',{required:true,maxLength:60}),
  status:field('Durum','enum',{required:true,values:['pending','confirmed','checked_in','completed','cancelled','no_show']}),
  start:field('Başlangıç','number',{required:true,min:0}),
  end:field('Bitiş','number',{required:true,min:0}),
  kind:field('Hareket','enum',{required:true,values:['created','updated','baseline']})
};
// SQL triggers also cover hold expiry and verified-payment status changes.
// Only a minimal allowlist is copied; tokens, notes, email and phone stay out.
export function installBookingEvents(store) {
  const snapshot=(alias,kind)=>"json_object('bookingId',"+alias+".id,'bookingRevision',"+alias+".revision,'reference',"+alias+".reference,'customerName',json_extract("+alias+".customer,'$.name'),'serviceId',"+alias+".service_id,'status',"+alias+".status,'start',"+alias+".start,'end',"+alias+".end,'kind','"+kind+"')";
  store.db.exec([
    "CREATE TABLE IF NOT EXISTS booking_changes(sequence INTEGER PRIMARY KEY AUTOINCREMENT,site_id TEXT NOT NULL,booking_id TEXT NOT NULL,revision INTEGER NOT NULL,data TEXT NOT NULL,created TEXT NOT NULL,UNIQUE(booking_id,revision));",
    "CREATE TABLE IF NOT EXISTS booking_event_migrations(version INTEGER PRIMARY KEY);",
    "CREATE TRIGGER IF NOT EXISTS booking_change_insert AFTER INSERT ON reservations BEGIN INSERT INTO booking_changes(site_id,booking_id,revision,data,created) VALUES (NEW.site_id,NEW.id,NEW.revision,"+snapshot('NEW','created')+",NEW.updated); END;",
    "CREATE TRIGGER IF NOT EXISTS booking_change_update AFTER UPDATE OF revision ON reservations WHEN NEW.revision<>OLD.revision BEGIN INSERT INTO booking_changes(site_id,booking_id,revision,data,created) VALUES (NEW.site_id,NEW.id,NEW.revision,"+snapshot('NEW','updated')+",NEW.updated); END;"
  ].join('\n'));
  if (!store.get('SELECT version FROM booking_event_migrations WHERE version=1')) store.transaction(()=>{
    store.run("INSERT OR IGNORE INTO booking_changes(site_id,booking_id,revision,data,created) SELECT r.site_id,r.id,r.revision,"+snapshot('r','baseline')+",r.updated FROM reservations r");
    store.run('INSERT OR IGNORE INTO booking_event_migrations VALUES (1)');
  });
}
export function bookingEventSource(store) {
  return {read:(after,limit)=>store.all('SELECT * FROM booking_changes WHERE sequence>? ORDER BY sequence LIMIT ?',after,limit).map(r=>({
    sequence:r.sequence,siteId:r.site_id,type:'booking.changed',actor:'system:booking-storage',occurredAt:r.created,data:JSON.parse(r.data)
  }))};
}
