import React,{useEffect,useState} from 'react';
import {Modal} from './editors.tsx';
export function RegionalPanel({base,request,onClose,canEdit}:{base:string;request:(url:string,method?:string,input?:unknown)=>Promise<any>;onClose:()=>void;canEdit:boolean}){
 const [countries,setCountries]=useState<any[]>([]),[options,setOptions]=useState<any>(null),[revision,setRevision]=useState(0),[values,setValues]=useState({country:'',locale:'',currency:'',timeZone:''}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function run(fn:()=>Promise<void>){setBusy(true);setError('');try{await fn();}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 useEffect(()=>{void run(async()=>{const [catalog,current]=await Promise.all([request(base+'/regional-options'),request(base+'/regional')]);setCountries(catalog.countries);setRevision(current.revision);if(current.values){setValues(current.values);setOptions(await request(base+'/regional-options?country='+current.values.country));}});},[base]);
 let example='';try{if(values.locale&&values.currency&&values.timeZone)example=new Intl.NumberFormat(values.locale,{style:'currency',currency:values.currency}).format(1234.5)+' · '+new Intl.DateTimeFormat(values.locale,{dateStyle:'long',timeStyle:'short',timeZone:values.timeZone}).format(new Date('2026-11-06T12:30:00Z'));}catch{}
 return <Modal title="Ülke ve bölgesel ayarlar" onClose={onClose}>
  <p>Ülke seçildiğinde dil, para birimi ve saat dilimi önerileri hazırlanır. Birden fazla saat dilimi olan ülkelerde seçim size bırakılır.</p>
  {error&&<p role="alert" className="error-banner">{error}</p>}{notice&&<p role="status" className="notice">{notice}</p>}
  <form onSubmit={e=>{e.preventDefault();void run(async()=>{const saved=await request(base+'/regional','PUT',{revision,values});setRevision(saved.revision);setValues(saved.values);setNotice('Bölgesel tercihler kaydedildi.');});}}>
   <fieldset disabled={!canEdit||busy}><label>Faaliyet ülkesi<select required value={values.country} onChange={e=>{const country=e.target.value;if(!country)return;void run(async()=>{const result=await request(base+'/regional-options?country='+country);setOptions(result);setValues(result.suggested);setNotice('Önerileri inceleyip kaydedin.');});}}><option value="">Ülke seçin…</option>{countries.map(country=><option key={country.id} value={country.id}>{country.name}</option>)}</select></label>
   <label>Dil ve biçim<input required maxLength={40} placeholder="tr-TR" value={values.locale} onChange={e=>setValues(v=>({...v,locale:e.target.value}))}/></label>
   <label>Para birimi<select required value={values.currency} onChange={e=>setValues(v=>({...v,currency:e.target.value}))}><option value="">Seçin…</option>{options?.currencies.map((currency:string)=><option key={currency}>{currency}</option>)}</select></label>
   <label>Saat dilimi<select required value={values.timeZone} onChange={e=>setValues(v=>({...v,timeZone:e.target.value}))}><option value="">Saat dilimi seçin…</option>{Array.from(new Set<string>([...(options?.timeZones||[]),...(values.timeZone?[values.timeZone]:[])])).map(zone=><option key={zone}>{zone}</option>)}</select></label>
   {example&&<p className="notice">Biçim örneği: {example}</p>}<button className="primary" disabled={busy}>Tercihleri kaydet</button></fieldset>
  </form>
  <p>Bu tercihler mevcut rezervasyonların para birimini veya saatlerini değiştirmez. Yönetim arayüzünün dilinden bağımsız site ayarlarıdır.</p>
  <div className="notice"><strong>Veri konumu ve ülke politikaları</strong><p>Bu kurulum yereldir. Ülke seçimi verilerinizi taşımaz ve mevzuat uygunluğu onayı oluşturmaz. Barındırılan sürümde veri bölgesi ve doğrulanmış ülke politikaları ayrıca yapılandırılır.</p></div>
 </Modal>;
}
