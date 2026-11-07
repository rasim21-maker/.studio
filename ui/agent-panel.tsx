import React,{useEffect,useState} from 'react';
import {Modal} from './editors.tsx';
import type {Document} from '../shared/v2/model.ts';

function changes(before:Document,after:Document){
 const rows:{label:string;before:string;after:string}[]=[];
 const add=(label:string,a:unknown,b:unknown)=>{if(a!==b)rows.push({label,before:String(a??''),after:String(b??'')});};
 for(const page of before.pages){const next=after.pages.find(p=>p.id===page.id);if(!next)continue;
  add(page.name+' / SEO başlığı',page.title,next.title);add(page.name+' / Açıklama',page.description,next.description);
  for(const section of page.sections)for(const field of section.fields){
   const value=next.sections.find(s=>s.id===section.id)?.fields.find(f=>f.id===field.id);if(!value)continue;
   const label=page.name+' / '+section.name+' / '+field.label;add(label,field.value,value.value);
   for(const locale of new Set([...Object.keys(field.translations||{}),...Object.keys(value.translations||{})]))add(label+' / '+locale,field.translations?.[locale],value.translations?.[locale]);
  }
 }return rows;
}
export function AgentPanel({base,request,document,revision,canManage,canAccept,onClose,onAccepted}:{base:string;request:(url:string,method?:string,input?:unknown)=>Promise<any>;document:Document;revision:number;canManage:boolean;canAccept:boolean;onClose:()=>void;onAccepted:()=>Promise<void>}){
 const [tokens,setTokens]=useState<any[]>([]),[proposals,setProposals]=useState<any[]>([]),[selected,setSelected]=useState<any>(null),[secret,setSecret]=useState(''),[label,setLabel]=useState(''),[hours,setHours]=useState(1),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function refresh(){const results=await Promise.all([request(base+'/ai-proposals'),canManage?request(base+'/agent-tokens'):Promise.resolve({tokens:[]})]);setProposals(results[0].proposals);setTokens(results[1].tokens);}
 async function run(fn:()=>Promise<void>){setBusy(true);setError('');try{await fn();}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 useEffect(()=>{void run(refresh);},[base]);
 return <Modal title="AI erişimi ve öneriler" onClose={onClose} wide>
  <p>AI yalnızca bu sitenin içeriğini okuyabilir ve öneri hazırlayabilir. Öneriler siz onaylamadan uygulanmaz; yayın, tasarım, üyeler ve ödeme işlemleri bu erişimin dışındadır.</p>
  {error&&<div role="alert" className="error-banner">{error}</div>}
  {canManage&&<details><summary>AI erişim anahtarları</summary><form onSubmit={e=>{e.preventDefault();void run(async()=>{const issued=await request(base+'/agent-tokens','POST',{label,hours});setSecret(issued.token);setLabel('');await refresh();});}}>
   <div className="two-cols"><label>Anahtar adı<input required maxLength={80} value={label} onChange={e=>setLabel(e.target.value)}/></label><label>Geçerlilik (saat)<input required type="number" min={1} max={24} step={1} value={hours} onChange={e=>setHours(Number(e.target.value))}/></label></div>
   <button className="primary" disabled={busy}>Sınırlı erişim oluştur</button>
  </form>{secret&&<div className="notice"><label>Yeni anahtar — yalnızca bu pencerede gösterilir<textarea readOnly rows={3} value={secret} autoComplete="off" spellCheck={false}/></label><p>Bu anahtarı yalnızca güvendiğiniz AI aracına aktarın. Site içeriğini okuma izni verir.</p><button onClick={()=>setSecret('')}>Anahtarı gizle</button></div>}
  <div className="history-list">{tokens.map(token=><div key={token.id}><div><strong>{token.label}</strong><p>{token.revoked?'İptal edildi':token.expires<Date.now()?'Süresi doldu':'Bitiş: '+new Date(token.expires).toLocaleString()}</p></div><button disabled={busy||!!token.revoked} onClick={()=>void run(async()=>{await request(base+'/agent-tokens','DELETE',{id:token.id});setSecret('');await refresh();})}>Erişimi iptal et</button></div>)}</div></details>}
  <div className="list-toolbar"><h3>İçerik önerileri</h3><button disabled={busy} onClick={()=>void run(refresh)}>Yenile</button></div>
  {!proposals.length&&<p>Henüz öneri yok.</p>}
  <div className="history-list">{proposals.map(proposal=><div key={proposal.id}><div><strong>{proposal.status==='pending'?'Onay bekliyor':proposal.status==='accepted'?'Uygulandı':'Reddedildi'}</strong><p>Sürüm {proposal.base_revision} · {new Date(proposal.created).toLocaleString()}</p></div><button onClick={()=>setSelected(proposal)}>Değişiklikleri incele</button></div>)}</div>
  {selected&&<section aria-label="Öneri karşılaştırması"><h3>Önerilen değişiklikler</h3>{selected.base_revision!==revision&&<p className="notice">Bu öneri eski bir sürüme ait. Güncel belge üzerinden yeni bir öneri hazırlanmalı.</p>}
   <div className="proposal-changes">{changes(document,selected.document).map((row,index)=><article key={index}><h4>{row.label}</h4><div className="two-cols"><div><strong>Mevcut</strong><pre>{row.before}</pre></div><div><strong>Önerilen</strong><pre>{row.after}</pre></div></div></article>)}</div>
   {selected.status==='pending'&&<div className="modal-actions"><button disabled={busy||!canAccept} onClick={()=>void run(async()=>{await request(base+'/ai-proposals/'+selected.id+'/reject','POST',{});setSelected(null);await refresh();})}>Reddet</button><button className="primary" disabled={busy||!canAccept||selected.base_revision!==revision} onClick={()=>void run(async()=>{await request(base+'/ai-proposals/'+selected.id+'/accept','POST',{revision});await onAccepted();onClose();})}>Onayla ve içeriğe uygula</button></div>}
  </section>}
 </Modal>;
}
