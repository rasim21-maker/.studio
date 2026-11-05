import {Booking} from './booking.mjs';
import {Integrations} from './integrations.mjs';
import {themes,templates,layoutDefaults,sectionDefaults} from './design.mjs';
import {fail} from './util.mjs';
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
async function rawBody(req,max=65536){let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>max)fail(413,'İstek çok büyük.');chunks.push(c);}return Buffer.concat(chunks);}
export async function createFeatures({store,dataDir,origin,security}){
 const booking=new Booking(store),integrations=await Integrations.open(store,dataDir,{fetcher:security.integrationFetcher||fetch});
 async function publicRoute({req,res,url,method,body,rateLimit}){
  const webhook=url.pathname.match(/^\/payments\/([a-z0-9-]+)\/(stripe\/webhook|iyzico\/callback)$/);
  if(webhook){const[,site,action]=webhook;if(method!=='POST')fail(405,'POST gerekli.');if(!store.get('SELECT id FROM sites WHERE id=?',site))fail(404,'Site yok.');rateLimit(`callback:${site}:${req.socket.remoteAddress}`,100);const raw=await rawBody(req);
   if(action==='stripe/webhook')json(res,200,await integrations.stripeWebhook(site,raw,req.headers['stripe-signature']));
   else{const token=new URLSearchParams(raw.toString()).get('token');const tx=typeof token==='string'&&token.length<500&&store.get("SELECT * FROM payment_transactions WHERE site_id=? AND provider='iyzico' AND reference=?",site,token);if(!tx)fail(404,'Ödeme bulunamadı.');await integrations.verify(site,tx.id);res.writeHead(303,{Location:`/book/${site}/?id=${tx.booking_id}`});res.end();}return true;
  }
  const match=url.pathname.match(/^\/public\/([a-z0-9-]+)\/(.*)$/);if(!match)return false;const[,site,tail]=match;
  if(!store.get('SELECT id FROM sites WHERE id=?',site))fail(404,'Site bulunamadı.');const c=booking.settings(site).values;
  const requestOrigin=req.headers.origin;if(requestOrigin&&requestOrigin!==origin&&!c.allowedOrigins.includes(requestOrigin))fail(403,'Bu web sitesi için erişim tanımlanmadı.');
  if(requestOrigin){res.setHeader('Access-Control-Allow-Origin',requestOrigin);res.setHeader('Vary','Origin');}
  if(method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Booking-Token');res.writeHead(204);res.end();return true;}
  if(method!=='GET'&&!requestOrigin)fail(403,'İstek kökeni gerekli.');rateLimit(`public:${site}:${req.socket.remoteAddress}`,120);
  if(tail==='catalog'&&method==='GET'){json(res,200,{participantMode:c.participantMode||'pets',enabled:c.publicEnabled,timezone:c.timezone,approval:c.approval,pendingMinutes:c.pendingMinutes,cancellationHours:c.cancellationHours,services:c.services.filter(s=>s.enabled).map(({resource,...s})=>s),payments:integrations.list(site).filter(p=>p.kind==='payment'&&p.ready).map(p=>({id:p.id,name:p.name,mode:p.mode,note:p.note}))});return true;}
  const gadget=tail.match(/^gadgets\/(weather|news|stocks|index|traffic)$/);if(gadget&&method==='GET'){json(res,200,await integrations.gadget(site,gadget[1]));return true;}
  if(!c.publicEnabled)fail(403,'Çevrimiçi rezervasyon henüz açılmadı.');
  if(tail==='availability'&&method==='POST'){json(res,200,booking.availability(site,await body(req)));return true;}
  if(tail==='bookings'&&method==='POST'){rateLimit(`reserve:${site}:${req.socket.remoteAddress}`,10);const input=await body(req);if(input.website)fail(422,'İstek kabul edilmedi.');json(res,201,booking.create(site,input,'customer',{publicRequest:true}));return true;}
  const b=tail.match(/^bookings\/([a-f0-9-]{36})(?:\/(cancel|checkout|verify))?$/);
  if(b){const token=req.headers['x-booking-token'];const r=booking.authorizePublic(site,b[1],token);
   if(method==='GET'&&!b[2]){json(res,200,{...booking.publicView(site,r.id,token),payments:integrations.paymentRows(site).filter(p=>p.booking_id===r.id)});return true;}
   if(method==='POST'){const input=await body(req);if(b[2]==='cancel')json(res,200,booking.cancelPublic(site,r.id,token,input.revision));else if(b[2]==='checkout'){rateLimit(`checkout:${r.id}`,8);json(res,200,await integrations.checkout(site,r,input.provider,input.billing,origin,req.socket.remoteAddress));}else if(b[2]==='verify'){if(!store.get('SELECT id FROM payment_transactions WHERE id=? AND site_id=? AND booking_id=?',input.paymentId,site,r.id))fail(404,'Ödeme bulunamadı.');json(res,200,await integrations.verify(site,input.paymentId));}else fail(404,'İşlem bulunamadı.');return true;}
  }fail(404,'İşlem bulunamadı.');
 }
 async function adminRoute({req,res,siteId,tail,method,body,user,authorize}){
  if(!/^(design|booking-settings|bookings(?:\/|$)|availability|calendar(?:\/|\.ics|$)|integrations(?:\/|$)|payments(?:\/|$))/.test(tail))return false;
  if(authorize)authorize();else store.membership(user.user_id,siteId,'admin');
  if(tail==='design'&&method==='GET')json(res,200,{themes,templates,layoutDefaults,sectionDefaults});
  else if(tail==='booking-settings'&&method==='GET')json(res,200,booking.settings(siteId));
  else if(tail==='booking-settings'&&method==='PUT')json(res,200,booking.saveSettings(siteId,await body(req),user.email));
  else if(tail==='bookings'&&method==='GET')json(res,200,{bookings:booking.list(siteId),payments:integrations.paymentRows(siteId)});
  else if(tail==='bookings'&&method==='POST')json(res,201,booking.create(siteId,await body(req),user.email));
  else if(tail==='availability'&&method==='POST')json(res,200,booking.availability(siteId,await body(req)));
  else if(/^bookings\/[a-f0-9-]{36}$/.test(tail)&&method==='PUT')json(res,200,booking.update(siteId,tail.split('/')[1],await body(req),user.email));
  else if(/^bookings\/[a-f0-9-]{36}\/checkout$/.test(tail)&&method==='POST'){const input=await body(req);json(res,200,await integrations.checkout(siteId,booking.row(siteId,tail.split('/')[1]),input.provider,input.billing,origin,req.socket.remoteAddress));}
  else if(tail==='calendar'&&method==='GET')json(res,200,{events:booking.events(siteId),bookings:booking.list(siteId),timezone:booking.settings(siteId).values.timezone});
  else if(tail==='calendar'&&method==='POST')json(res,201,booking.event(siteId,await body(req),user.email));
  else if(/^calendar\/[a-f0-9-]{36}$/.test(tail)&&method==='PUT')json(res,200,booking.event(siteId,await body(req),user.email,tail.split('/')[1]));
  else if(/^calendar\/[a-f0-9-]{36}$/.test(tail)&&method==='DELETE')json(res,200,booking.removeEvent(siteId,tail.split('/')[1],(await body(req)).revision,user.email));
  else if(tail==='calendar.ics'&&method==='GET'){res.writeHead(200,{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'attachment; filename="loft-calendar.ics"'});res.end(booking.ics(siteId));}
  else if(tail==='integrations'&&method==='GET')json(res,200,{providers:integrations.list(siteId)});
  else if(/^integrations\/[a-z]+$/.test(tail)&&method==='PUT')json(res,200,integrations.save(siteId,tail.split('/')[1],await body(req),user.email));
  else if(/^integrations\/(weather|news|stocks|index|traffic)\/test$/.test(tail)&&method==='POST')json(res,200,await integrations.gadget(siteId,tail.split('/')[1],{refresh:true}));
  else if(tail==='payments'&&method==='GET')json(res,200,{payments:integrations.paymentRows(siteId)});
  else if(/^payments\/[a-f0-9-]{36}\/verify$/.test(tail)&&method==='POST')json(res,200,await integrations.verify(siteId,tail.split('/')[1]));
  else fail(404,'İşlem bulunamadı.');return true;
 }
 return{booking,integrations,publicRoute,adminRoute};
}
