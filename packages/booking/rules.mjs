import {fail} from '@loft-studio/sdk';
import {createHash} from 'node:crypto';
const hash = value => createHash('sha256').update(value).digest('hex');
const canonical = value => Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const requestFingerprint = (input,publicRequest) => hash(JSON.stringify(canonical({
 version:1,publicRequest,serviceId:input.serviceId,start:input.start||null,startDate:input.startDate||null,endDate:input.endDate||null,
 quantity:Number(input.quantity??1),customer:input.customer,participants:input.participants||[],pets:input.pets||[],
 notes:input.notes||'',consent:input.consent===true,status:publicRequest?null:(input.status==='confirmed'?'confirmed':'pending')
})));
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
 const p=localParts(epoch,zone);if(`${p.date}T${p.time}`!==value)fail(422,'Bu yerel saat saat diliminde mevcut değil.');
 for(const delta of [-36,36]){const probe=epoch+delta*3600000,parts=localParts(probe,zone),offset=Date.parse(`${parts.date}T${parts.time}Z`)-probe,candidate=nominal-offset;if(candidate!==epoch){const other=localParts(candidate,zone);if(`${other.date}T${other.time}`===value)fail(422,'Saat değişimi nedeniyle bu saat iki kez oluşuyor; farklı bir saat seçin.');}}
 return epoch;
}
export const bookingDefaults=()=>({timezone:'Europe/Istanbul',publicEnabled:false,approval:'manual',pendingMinutes:30,cancellationHours:24,allowedOrigins:[],runtimeUrl:'',services:[
 {id:'pet-hotel',name:'Pet Hotel',kind:'overnight',enabled:false,resource:'hotel',capacity:10,priceMinor:0,currency:'TRY',durationMinutes:60,stepMinutes:30,bufferMinutes:0,minNoticeHours:24,maxAdvanceDays:365,minNights:1,maxNights:30,checkIn:'14:00',checkOut:'11:00',hours:['09:00','18:30'],weekdays:[0,1,2,3,4,5,6]},
 {id:'pet-grooming',name:'Bakım & Kuaför',kind:'appointment',enabled:false,resource:'grooming',capacity:1,priceMinor:0,currency:'TRY',durationMinutes:60,stepMinutes:30,bufferMinutes:15,minNoticeHours:2,maxAdvanceDays:90,minNights:1,maxNights:30,checkIn:'14:00',checkOut:'11:00',hours:['09:00','18:30'],weekdays:[1,2,3,4,5,6]}]});
export function validateBookingSettings(c){
 if(!c||typeof c!=='object')fail(422,'Rezervasyon ayarları gerekli.');
 if(c.participantMode!==undefined&&!['generic','pets'].includes(c.participantMode))fail(422,'Katılımcı modeli geçersiz.');
 try{new Intl.DateTimeFormat('en',{timeZone:c.timezone}).format();}catch{fail(422,'Geçersiz saat dilimi.');}
 if(typeof c.publicEnabled!=='boolean'||!['manual','automatic'].includes(c.approval)||!integer(c.pendingMinutes,5,1440)||!integer(c.cancellationHours,0,720))fail(422,'Rezervasyon politikası geçersiz.');
 if(!Array.isArray(c.allowedOrigins)||c.allowedOrigins.length>10||c.allowedOrigins.some(o=>{try{const u=new URL(o);return u.origin!==o||u.protocol!=='https:';}catch{return true;}}))fail(422,'İzin verilen kökenler tam HTTPS kökenleri olmalı.');
 if(c.runtimeUrl){try{const u=new URL(c.runtimeUrl);if(typeof c.runtimeUrl!=='string'||u.protocol!=='https:'||u.username||u.password||u.search||u.hash||/[\s<>"']/.test(c.runtimeUrl))throw Error();}catch{fail(422,'Canlı rezervasyon sunucusu için kimlik bilgisi içermeyen HTTPS URL gerekli.');}}
 if(!Array.isArray(c.services)||c.services.length>30)fail(422,'En çok 30 hizmet tanımlayın.');const ids=new Set(),resources=new Map();
 for(const s of c.services){
  if(!/^[a-z0-9-]{1,60}$/.test(s.id)||ids.has(s.id)||!text(s.name,100,true)||!['overnight','appointment'].includes(s.kind)||typeof s.enabled!=='boolean'||!/^[a-z0-9-]{1,60}$/.test(s.resource))fail(422,'Hizmet kimliği, adı veya türü geçersiz.');ids.add(s.id);
  for(const [k,a,b] of [['capacity',1,1000],['priceMinor',0,100000000],['durationMinutes',5,720],['stepMinutes',5,240],['bufferMinutes',0,240],['minNoticeHours',0,8760],['maxAdvanceDays',1,730],['minNights',1,90],['maxNights',1,365]])if(!integer(s[k],a,b))fail(422,`${s.name}: ${k} sınır dışında.`);
  if(s.minNights>s.maxNights||!['TRY','USD','EUR','GBP'].includes(s.currency)||!hhmm(s.checkIn)||!hhmm(s.checkOut)||!Array.isArray(s.hours)||s.hours.length!==2||!s.hours.every(hhmm)||s.hours[0]>=s.hours[1]||!Array.isArray(s.weekdays)||!s.weekdays.length||new Set(s.weekdays).size!==s.weekdays.length||s.weekdays.some(d=>!integer(d,0,6)))fail(422,`${s.name}: tarih, para birimi veya çalışma saatleri geçersiz.`);
  if(resources.has(s.resource)&&resources.get(s.resource)!==s.capacity)fail(422,'Aynı kaynağı kullanan hizmetlerin kapasitesi aynı olmalı.');resources.set(s.resource,s.capacity);
 }
 return c;
}

export function bookingInterval(c,s,input,{past=false}={}){
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
export {hash,requestFingerprint,states,occupying,transitions,text,integer,dateOnly};
