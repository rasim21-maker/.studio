import {randomUUID, randomBytes} from 'node:crypto';
import {fail,hash} from './util.mjs';
const states=['pending','confirmed','checked_in','completed','cancelled','no_show'];
const occupying=new Set(['pending','confirmed','checked_in']);
const transitions={pending:['confirmed','cancelled'],confirmed:['checked_in','completed','cancelled','no_show'],checked_in:['completed','cancelled'],completed:[],cancelled:[],no_show:[]};
const text=(v,max,required=false)=>typeof v==='string'&&v.length<=max&&(!required||v.trim())&&!/[<>\u0000-\u001f]/.test(v);
const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const dateOnly=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().startsWith(s);
const hhmm=s=>/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export function localParts(epoch,zone){const f=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});const p=Object.fromEntries(f.formatToParts(new Date(epoch)).map(x=>[x.type,x.value]));return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};}
export function localEpoch(value,zone){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)||!dateOnly(value.slice(0,10))||!hhmm(value.slice(11)))fail(422,'Geçerli yerel tarih ve saat girin.');
 const nominal=Date.parse(value+'Z');let epoch=nominal;
 for(let i=0;i<4;i++){const p=localParts(epoch,zone);epoch+=nominal-Date.parse(`${p.date}T${p.time}Z`);}
 const p=localParts(epoch,zone);if(`${p.date}T${p.time}`!==value)fail(422,'Bu yerel saat saat diliminde mevcut değil.');return epoch;
}
export const bookingDefaults=()=>({timezone:'Europe/Istanbul',publicEnabled:false,approval:'manual',pendingMinutes:30,cancellationHours:24,allowedOrigins:[],runtimeUrl:'',services:[
 {id:'pet-hotel',name:'Pet Hotel',kind:'overnight',enabled:false,resource:'hotel',capacity:10,priceMinor:0,currency:'TRY',durationMinutes:60,stepMinutes:30,bufferMinutes:0,minNoticeHours:24,maxAdvanceDays:365,minNights:1,maxNights:30,checkIn:'14:00',checkOut:'11:00',hours:['09:00','18:30'],weekdays:[0,1,2,3,4,5,6]},
 {id:'pet-grooming',name:'Bakım & Kuaför',kind:'appointment',enabled:false,resource:'grooming',capacity:1,priceMinor:0,currency:'TRY',durationMinutes:60,stepMinutes:30,bufferMinutes:15,minNoticeHours:2,maxAdvanceDays:90,minNights:1,maxNights:30,checkIn:'14:00',checkOut:'11:00',hours:['09:00','18:30'],weekdays:[1,2,3,4,5,6]}]});
export function validateBookingSettings(c){
 if(!c||typeof c!=='object')fail(422,'Rezervasyon ayarları gerekli.');
 try{new Intl.DateTimeFormat('en',{timeZone:c.timezone}).format();}catch{fail(422,'Geçersiz saat dilimi.');}
 if(typeof c.publicEnabled!=='boolean'||!['manual','automatic'].includes(c.approval)||!integer(c.pendingMinutes,5,1440)||!integer(c.cancellationHours,0,720))fail(422,'Rezervasyon politikası geçersiz.');
 if(!Array.isArray(c.allowedOrigins)||c.allowedOrigins.length>10||c.allowedOrigins.some(o=>{try{const u=new URL(o);return u.origin!==o||u.protocol!=='https:';}catch{return true;}}))fail(422,'İzin verilen kökenler tam HTTPS kökenleri olmalı.');
 if(c.runtimeUrl && !/^https:\/\/[^\s?#]+$/.test(c.runtimeUrl))fail(422,'Canlı rezervasyon sunucusu için HTTPS URL gerekli.');
 if(!Array.isArray(c.services)||c.services.length>30)fail(422,'En çok 30 hizmet tanımlayın.');const ids=new Set(),resources=new Map();
 for(const s of c.services){
  if(!/^[a-z0-9-]{1,60}$/.test(s.id)||ids.has(s.id)||!text(s.name,100,true)||!['overnight','appointment'].includes(s.kind)||typeof s.enabled!=='boolean'||!/^[a-z0-9-]{1,60}$/.test(s.resource))fail(422,'Hizmet kimliği, adı veya türü geçersiz.');ids.add(s.id);
  for(const [k,a,b] of [['capacity',1,1000],['priceMinor',0,100000000],['durationMinutes',5,720],['stepMinutes',5,240],['bufferMinutes',0,240],['minNoticeHours',0,8760],['maxAdvanceDays',1,730],['minNights',1,90],['maxNights',1,365]])if(!integer(s[k],a,b))fail(422,`${s.name}: ${k} sınır dışında.`);
  if(s.minNights>s.maxNights||!['TRY','USD','EUR','GBP'].includes(s.currency)||!hhmm(s.checkIn)||!hhmm(s.checkOut)||!Array.isArray(s.hours)||s.hours.length!==2||!s.hours.every(hhmm)||s.hours[0]>=s.hours[1]||!Array.isArray(s.weekdays)||!s.weekdays.length||new Set(s.weekdays).size!==s.weekdays.length||s.weekdays.some(d=>!integer(d,0,6)))fail(422,`${s.name}: tarih, para birimi veya çalışma saatleri geçersiz.`);
  if(resources.has(s.resource)&&resources.get(s.resource)!==s.capacity)fail(422,'Aynı kaynağı kullanan hizmetlerin kapasitesi aynı olmalı.');resources.set(s.resource,s.capacity);
 }
 return c;
}
export class Booking {
 constructor(store){this.store=store;store.db.exec(`CREATE TABLE IF NOT EXISTS booking_settings(site_id TEXT PRIMARY KEY REFERENCES sites(id),revision INTEGER NOT NULL,content TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS reservations(id TEXT PRIMARY KEY,site_id TEXT NOT NULL REFERENCES sites(id),revision INTEGER NOT NULL,reference TEXT UNIQUE NOT NULL,service_id TEXT NOT NULL,resource TEXT NOT NULL,start INTEGER NOT NULL,end INTEGER NOT NULL,busy_start INTEGER NOT NULL,busy_end INTEGER NOT NULL,quantity INTEGER NOT NULL,status TEXT NOT NULL,hold_until INTEGER,price_minor INTEGER NOT NULL,currency TEXT NOT NULL,customer TEXT NOT NULL,pets TEXT NOT NULL,notes TEXT NOT NULL,token_hash TEXT NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS booking_capacity ON reservations(site_id,resource,busy_start,busy_end,status);
 CREATE TABLE IF NOT EXISTS calendar_events(id TEXT PRIMARY KEY,site_id TEXT NOT NULL REFERENCES sites(id),revision INTEGER NOT NULL,title TEXT NOT NULL,start INTEGER NOT NULL,end INTEGER NOT NULL,resource TEXT NOT NULL,blocks INTEGER NOT NULL,notes TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS booking_requests(site_id TEXT NOT NULL,request_id TEXT NOT NULL,booking_id TEXT NOT NULL,PRIMARY KEY(site_id,request_id));`);}
 settings(site){let r=this.store.get('SELECT * FROM booking_settings WHERE site_id=?',site);if(!r){this.store.run('INSERT INTO booking_settings VALUES (?,0,?)',site,JSON.stringify(bookingDefaults()));r=this.store.get('SELECT * FROM booking_settings WHERE site_id=?',site);}return{revision:r.revision,values:JSON.parse(r.content)};}
 saveSettings(site,input,actor){const c=validateBookingSettings(input.values);return this.store.transaction(()=>{
  const old=this.settings(site);if(input.revision!==old.revision)fail(409,'Rezervasyon ayarları değişti. Yeniden yükleyin.');this.expire(site);
  for(const service of old.values.services){
   const next=c.services.find(s=>s.id===service.id);
   if(!next&&this.store.get('SELECT id FROM reservations WHERE site_id=? AND service_id=? LIMIT 1',site,service.id))fail(409,'Rezervasyon geçmişi olan hizmet silinemez; hizmeti kapatın.');
   if(next&&(next.kind!==service.kind||next.resource!==service.resource)&&this.store.get("SELECT id FROM reservations WHERE site_id=? AND service_id=? AND status IN ('pending','confirmed','checked_in') LIMIT 1",site,service.id))fail(409,'Aktif rezervasyonu olan hizmetin türü veya kaynağı değiştirilemez.');
  }
  for(const [resource,capacity] of new Map(c.services.map(s=>[s.resource,s.capacity]))){
   const rows=this.store.all("SELECT busy_start,busy_end,quantity FROM reservations WHERE site_id=? AND resource=? AND busy_end>? AND status IN ('pending','confirmed','checked_in')",site,resource,Date.now());
   const points=rows.flatMap(r=>[[r.busy_start,r.quantity],[r.busy_end,-r.quantity]]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let used=0;
   for(const [,quantity] of points){used+=quantity;if(used>capacity)fail(409,'Yeni kapasite mevcut rezervasyonları karşılamıyor. Önce rezervasyonları düzenleyin.');}
  }
  const revision=old.revision+1;this.store.run('UPDATE booking_settings SET revision=?,content=? WHERE site_id=?',revision,JSON.stringify(c),site);this.store.event(site,actor,'booking_settings',{revision});return{revision,values:c};
 });}
 expire(site){this.store.run("UPDATE reservations SET status='cancelled',revision=revision+1,updated=? WHERE site_id=? AND status='pending' AND hold_until IS NOT NULL AND hold_until<=?",new Date().toISOString(),site,Date.now());}
 service(site,id){const c=this.settings(site).values,s=c.services.find(s=>s.id===id&&s.enabled);if(!s)fail(422,'Hizmet etkin değil.');return{c,s};}
 interval(c,s,input,{past=false}={}){
  let start,end,nights=1;
  if(s.kind==='overnight'){
   if(!dateOnly(input.startDate||'')||!dateOnly(input.endDate||''))fail(422,'Giriş ve çıkış tarihlerini seçin.');
   nights=(Date.parse(input.endDate)-Date.parse(input.startDate))/86400000;if(nights<s.minNights||nights>s.maxNights)fail(422,`Konaklama ${s.minNights}–${s.maxNights} gece olmalı.`);
   start=localEpoch(input.startDate+'T'+s.checkIn,c.timezone);end=localEpoch(input.endDate+'T'+s.checkOut,c.timezone);
  }else{
   start=localEpoch(input.start,c.timezone);end=start+s.durationMinutes*60000;
   const p=localParts(start,c.timezone),q=localParts(end,c.timezone),day=new Date(p.date+'T12:00Z').getUTCDay();
   const minutes=v=>Number(v.slice(0,2))*60+Number(v.slice(3));
   if(!s.weekdays.includes(day)||p.date!==q.date||p.time<s.hours[0]||q.time>s.hours[1]||(minutes(p.time)-minutes(s.hours[0]))%s.stepMinutes)fail(422,'Seçilen saat çalışma saatlerine veya randevu aralığına uygun değil.');
  }
  if(end<=start)fail(422,'Bitiş başlangıçtan sonra olmalı.');
  if(!past&&start<Date.now()+s.minNoticeHours*3600000)fail(422,'Rezervasyon için minimum ön bildirim süresi sağlanmıyor.');
  if(start>Date.now()+s.maxAdvanceDays*86400000)fail(422,'Rezervasyon ileri tarih sınırını aşıyor.');
  const quantity=Number(input.quantity??1);if(!integer(quantity,1,s.capacity))fail(422,'Kişi/pet adedi kapasite dışında.');
  return{start,end,busyStart:start-s.bufferMinutes*60000,busyEnd:end+s.bufferMinutes*60000,quantity,priceMinor:s.priceMinor*nights*quantity,currency:s.currency};
 }
 capacity(site,s,t,except=''){
  this.expire(site);
  if(this.store.get('SELECT id FROM calendar_events WHERE site_id=? AND blocks=1 AND (resource=? OR resource=?) AND start<? AND end>?',site,s.resource,'all',t.busyEnd,t.busyStart))return 0;
  const rows=this.store.all("SELECT busy_start,busy_end,quantity FROM reservations WHERE site_id=? AND resource=? AND id<>? AND status IN ('pending','confirmed','checked_in') AND busy_start<? AND busy_end>?",site,s.resource,except,t.busyEnd,t.busyStart);
  const points=rows.flatMap(r=>[[Math.max(r.busy_start,t.busyStart),r.quantity],[Math.min(r.busy_end,t.busyEnd),-r.quantity]]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let n=0,max=0;for(const [,v]of points){n+=v;max=Math.max(n,max);}return Math.max(0,s.capacity-max);
 }
 availability(site,input){const{c,s}=this.service(site,input.serviceId);if(s.kind==='overnight'){const t=this.interval(c,s,input);return{available:this.capacity(site,s,t)>=t.quantity,remaining:this.capacity(site,s,t),...t,timezone:c.timezone};}
  if(!dateOnly(input.date||''))fail(422,'Geçerli tarih seçin.');const slots=[];const toMin=v=>Number(v.slice(0,2))*60+Number(v.slice(3));
  for(let m=toMin(s.hours[0]);m+s.durationMinutes<=toMin(s.hours[1]);m+=s.stepMinutes){const start=`${input.date}T${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;try{const t=this.interval(c,s,{start,quantity:Number(input.quantity||1)});const remaining=this.capacity(site,s,t);slots.push({start,remaining,available:remaining>=t.quantity,priceMinor:t.priceMinor,currency:t.currency});}catch(e){if(!e.status)throw e;}}
  return{slots,timezone:c.timezone};
 }
 row(site,id){const r=this.store.get('SELECT * FROM reservations WHERE id=? AND site_id=?',id,site);if(!r)fail(404,'Rezervasyon bulunamadı.');return r;}
 present(r){const{token_hash,...rest}=r;return{...rest,customer:JSON.parse(r.customer),pets:JSON.parse(r.pets)};}
 list(site){this.expire(site);return this.store.all('SELECT * FROM reservations WHERE site_id=? ORDER BY start DESC LIMIT 1000',site).map(r=>this.present(r));}
 create(site,input,actor,{publicRequest=false}={}){
  const{c,s}=this.service(site,input.serviceId);if(publicRequest&&!c.publicEnabled)fail(403,'Çevrimiçi rezervasyon henüz açılmadı.');
  if(!/^[a-f0-9-]{36}$/.test(input.requestId||''))fail(422,'Tekil istek kimliği gerekli.');
  const customer=input.customer;if(!customer||!text(customer.name,120,true)||!text(customer.email,254,true)||!/^\S+@\S+\.\S+$/.test(customer.email)||!text(customer.phone,40,true))fail(422,'Ad, geçerli e-posta ve telefon gerekli.');
  if(!Array.isArray(input.pets)||!input.pets.length||input.pets.length>20||input.pets.some(p=>!text(p.name,80,true)||!['dog','cat','other'].includes(p.species)||!text(p.notes||'',1500)))fail(422,'En az bir petin adı ve türü gerekli.');
  if(!text(input.notes||'',3000)||input.consent!==true)fail(422,'Not alanı veya rezervasyon veri onayı eksik.');
  const t=this.interval(c,s,input);if(input.pets.length!==t.quantity)fail(422,'Pet sayısı rezervasyon adediyle aynı olmalı.');
  return this.store.transaction(()=>{
   const existing=this.store.get('SELECT booking_id FROM booking_requests WHERE site_id=? AND request_id=?',site,input.requestId);if(existing){const r=this.row(site,existing.booking_id);if(publicRequest)return{reference:r.reference,duplicate:true};return this.present(r);}
   if(this.capacity(site,s,t)<t.quantity)fail(409,'Bu zaman aralığı için yeterli kapasite yok.');
   const id=randomUUID(),reference='LFT-'+randomBytes(5).toString('hex').toUpperCase(),manageToken=randomBytes(32).toString('base64url'),now=new Date().toISOString();
   const status=publicRequest?(c.approval==='automatic'?'confirmed':'pending'):(input.status==='confirmed'?'confirmed':'pending');
   const hold=status==='pending'?Date.now()+c.pendingMinutes*60000:null;
   this.store.run('INSERT INTO reservations VALUES (?,?,0,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id,site,reference,s.id,s.resource,t.start,t.end,t.busyStart,t.busyEnd,t.quantity,status,hold,t.priceMinor,t.currency,JSON.stringify(customer),JSON.stringify(input.pets),input.notes||'',hash(manageToken),now,now);
   this.store.run('INSERT INTO booking_requests VALUES (?,?,?)',site,input.requestId,id);this.store.event(site,actor,'booking_created',{id,reference,status});
   const r=this.present(this.row(site,id));return publicRequest?{id,reference,status,manageToken,start:r.start,end:r.end,priceMinor:r.price_minor,currency:r.currency,holdUntil:hold}:r;
  });
 }
 update(site,id,input,actor){return this.store.transaction(()=>{
  this.expire(site);const r=this.row(site,id);if(input.revision!==r.revision)fail(409,'Rezervasyon değişti. Yeniden yükleyin.');
  const status=input.status??r.status;if(!states.includes(status)||(status!==r.status&&!transitions[r.status].includes(status)))fail(422,'Bu durum geçişine izin verilmiyor.');
  let t={start:r.start,end:r.end,busyStart:r.busy_start,busyEnd:r.busy_end,quantity:r.quantity,priceMinor:r.price_minor,currency:r.currency};
  if(input.start||input.startDate){if(!occupying.has(r.status))fail(422,'Kapanmış rezervasyon taşınamaz.');if(this.store.get("SELECT id FROM payment_transactions WHERE booking_id=? AND status IN ('created','paid','review','processing')",id))fail(409,'Ödeme süreci olan rezervasyonu önce iptal/iade akışıyla çözümleyin.');const{c,s}=this.service(site,r.service_id);t=this.interval(c,s,{...input,quantity:r.quantity});if(this.capacity(site,s,t,id)<t.quantity)fail(409,'Yeni zaman aralığında kapasite yok.');}
  if(!text(input.notes??r.notes,3000))fail(422,'Geçersiz not.');
  this.store.run('UPDATE reservations SET revision=revision+1,status=?,start=?,end=?,busy_start=?,busy_end=?,price_minor=?,currency=?,hold_until=?,notes=?,updated=? WHERE id=?',status,t.start,t.end,t.busyStart,t.busyEnd,t.priceMinor,t.currency,status==='pending'?r.hold_until:null,input.notes??r.notes,new Date().toISOString(),id);
  this.store.event(site,actor,'booking_updated',{id,status});return this.present(this.row(site,id));
 });}
 authorizePublic(site,id,token){this.expire(site);const r=this.row(site,id);if(typeof token!=='string'||token.length>200||hash(token)!==r.token_hash)fail(404,'Rezervasyon bulunamadı.');return r;}
 publicView(site,id,token){const r=this.authorizePublic(site,id,token);return{id:r.id,reference:r.reference,revision:r.revision,status:r.status,start:r.start,end:r.end,priceMinor:r.price_minor,currency:r.currency,serviceId:r.service_id,holdUntil:r.hold_until};}
 cancelPublic(site,id,token,revision){const r=this.authorizePublic(site,id,token),c=this.settings(site).values;if(r.start-Date.now()<c.cancellationHours*3600000)fail(422,'Çevrimiçi iptal süresi doldu. İşletmeyle iletişime geçin.');return this.update(site,id,{revision,status:'cancelled'},'customer');}
 events(site){return this.store.all('SELECT * FROM calendar_events WHERE site_id=? ORDER BY start LIMIT 1000',site);}
 event(site,input,actor,id){
  const c=this.settings(site).values;if(!text(input.title,120,true)||!text(input.notes||'',1500)||typeof input.blocks!=='boolean'||!(input.resource==='all'||c.services.some(s=>s.resource===input.resource)))fail(422,'Takvim etkinliği alanları geçersiz.');
  const start=localEpoch(input.start,c.timezone),end=localEpoch(input.end,c.timezone);if(end<=start||end-start>366*86400000)fail(422,'Takvim tarih aralığı geçersiz.');
  const repeat=input.repeat||'none',count=Number(input.count||1);if(!['none','daily','weekly'].includes(repeat)||!integer(count,1,52)||(repeat==='none'&&count!==1))fail(422,'Yineleme ayarı geçersiz.');
  return this.store.transaction(()=>{
   if(id){const old=this.store.get('SELECT * FROM calendar_events WHERE id=? AND site_id=?',id,site);if(!old)fail(404,'Etkinlik bulunamadı.');if(old.revision!==input.revision)fail(409,'Etkinlik başka oturumda değişti.');if(count!==1)fail(422,'Düzenlerken yineleme eklenemez.');}
   const ids=[];
   for(let n=0;n<count;n++){const offset=n*(repeat==='weekly'?7:1)*86400000;
    // Advance the local calendar date, preserving wall-clock hours across DST.
    const shifted=v=>{const d=new Date(Date.parse(v.slice(0,10)+'T12:00Z')+offset).toISOString().slice(0,10);return localEpoch(d+v.slice(10),c.timezone);};
    const a=shifted(input.start),b=shifted(input.end);
    if(input.blocks&&this.store.get("SELECT id FROM reservations WHERE site_id=? AND (?='all' OR resource=?) AND status IN ('pending','confirmed','checked_in') AND busy_start<? AND busy_end>?",site,input.resource,input.resource,b,a))fail(409,'Bu kapalı zaman aralığında mevcut rezervasyon var. Önce rezervasyonu taşıyın.');
    const eventId=id||randomUUID();if(id)this.store.run('UPDATE calendar_events SET revision=revision+1,title=?,start=?,end=?,resource=?,blocks=?,notes=? WHERE id=?',input.title,a,b,input.resource,Number(input.blocks),input.notes||'',id);else this.store.run('INSERT INTO calendar_events VALUES (?,?,0,?,?,?,?,?,?)',eventId,site,input.title,a,b,input.resource,Number(input.blocks),input.notes||'');ids.push(eventId);
   }this.store.event(site,actor,'calendar_saved',{ids});return{ids};
  });
 }
 removeEvent(site,id,revision,actor){const r=this.store.get('SELECT * FROM calendar_events WHERE id=? AND site_id=?',id,site);if(!r)fail(404,'Etkinlik bulunamadı.');if(r.revision!==revision)fail(409,'Etkinlik değişti.');this.store.run('DELETE FROM calendar_events WHERE id=? AND site_id=?',id,site);this.store.event(site,actor,'calendar_removed',{id});return{ok:true};}
 ics(site){const esc=s=>String(s).replaceAll('\\','\\\\').replaceAll('\n','\\n').replaceAll(',','\\,').replaceAll(';','\\;').replaceAll('\r',''),stamp=t=>new Date(t).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const events=[...this.list(site).filter(r=>r.status!=='cancelled').map(r=>({id:r.id,title:`${r.reference} · ${r.customer.name}`,start:r.start,end:r.end,notes:`${r.status} · ${r.pets.map(p=>p.name).join(', ')}`})),...this.events(site)];
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Loft Studio//Booking//TR','CALSCALE:GREGORIAN',...events.flatMap(e=>['BEGIN:VEVENT',`UID:${e.id}@loft-studio`,`DTSTAMP:${stamp(Date.now())}`,`DTSTART:${stamp(e.start)}`,`DTEND:${stamp(e.end)}`,`SUMMARY:${esc(e.title)}`,`DESCRIPTION:${esc(e.notes)}`,'END:VEVENT']),'END:VCALENDAR'];
  return lines.map(line=>{let out='',current='';for(const ch of line){if(Buffer.byteLength(current+ch)>73){out+=current+'\r\n ';current='';}current+=ch;}return out+current;}).join('\r\n')+'\r\n';
 }
}
