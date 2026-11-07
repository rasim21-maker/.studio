import {countries} from 'countries-list';
import {fail} from '../util.mjs';
const currencyCodes=new Set(Object.values(countries).flatMap(c=>c.currency));
export const regionalSource={package:'countries-list',version:'3.4.1',license:'MIT',url:'https://github.com/annexare/Countries'};
export function countryCatalog(locale='tr'){
 const labels=new Intl.DisplayNames([locale],{type:'region'});
 return Object.entries(countries).map(([id,value])=>({id,name:labels.of(id)||value.name})).sort((a,b)=>a.name.localeCompare(b.name,locale));
}
export function countryOptions(country){
 if(typeof country!=='string'||!Object.hasOwn(countries,country))fail(422,'Listeden bir ülke seçin.');
 const data=countries[country],locale=new Intl.Locale('und-'+country).maximize(),zones=locale.getTimeZones()||[];
 return {country,languages:data.languages,currencies:[...new Set([...data.currency,...[...currencyCodes].sort()])],timeZones:zones.length?zones:['UTC'],suggested:{country,locale:locale.minimize().toString(),currency:data.currency[0]||'',timeZone:zones.length===1?zones[0]:''},requiresTimeZoneSelection:zones.length!==1,source:regionalSource};
}
export function validateRegional(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['country','locale','currency','timeZone'].includes(k)))fail(422,'Bölgesel ayar sözleşmesi geçersiz.');
 countryOptions(input.country);
 if(typeof input.locale!=='string'||input.locale.length>40||typeof input.timeZone!=='string'||input.timeZone.length>80||!/^[A-Za-z][A-Za-z0-9_+\/-]*$/.test(input.timeZone)||!currencyCodes.has(input.currency))fail(422,'Dil, saat dilimi veya para birimi geçersiz.');
 let locale,timeZone;
 try{locale=Intl.getCanonicalLocales(input.locale)[0];if(!locale||!Intl.DateTimeFormat.supportedLocalesOf([locale]).length)throw Error();timeZone=new Intl.DateTimeFormat(locale,{timeZone:input.timeZone}).resolvedOptions().timeZone;}catch{fail(422,'Desteklenen bir dil ve IANA saat dilimi seçin.');}
 return {country:input.country,locale,currency:input.currency,timeZone};
}
export function createRegionalSettings({store,access,audit}){
 store.db.exec('CREATE TABLE IF NOT EXISTS studio_regional_settings(site_id TEXT PRIMARY KEY REFERENCES studio_sites(id),revision INTEGER NOT NULL,settings TEXT NOT NULL,actor TEXT NOT NULL,updated TEXT NOT NULL);');
 function read(siteId){
  const row=store.get('SELECT * FROM studio_regional_settings WHERE site_id=?',siteId);
  return {revision:row?.revision||0,values:row?JSON.parse(row.settings):null,hosting:{profile:'local',dataRegion:null},regulatory:{status:'needs-review',ruleset:null},source:regionalSource};
 }
 async function route({req,user,siteId,action,method,url,body,send}){
  if(action==='regional-options'&&method==='GET'){access(user,siteId);const country=url.searchParams.get('country');return send(country?countryOptions(country):{countries:countryCatalog()});}
  if(action!=='regional')return false;
  access(user,siteId);
  if(method==='GET')return send(read(siteId));
  if(method==='PUT'){
   access(user,siteId,'members');const input=await body(req),site=access(user,siteId,'members'),values=validateRegional(input.values);
   return send(store.transaction(()=>{
    const before=read(siteId);if(!Number.isInteger(input.revision)||before.revision!==input.revision)fail(409,'Bölgesel ayarlar başka bir oturumda değişti.');
    store.run('INSERT INTO studio_regional_settings VALUES (?,?,?,?,?) ON CONFLICT(site_id) DO UPDATE SET revision=excluded.revision,settings=excluded.settings,actor=excluded.actor,updated=excluded.updated',siteId,before.revision+1,JSON.stringify(values),user.user_id,new Date().toISOString());
    audit(site,user,'regional.settings',site.revision,{settingsRevision:before.revision+1,country:values.country});return read(siteId);
   }));
  }return false;
 }
 return {read,route};
}
