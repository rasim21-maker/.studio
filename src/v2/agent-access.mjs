import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {fail} from '../util.mjs';
import {validateDocument} from '../../shared/v2/validation.ts';
const hash=value=>createHash('sha256').update(value).digest('hex');
const encode=value=>JSON.stringify(value);
const design=doc=>encode({theme:doc.theme,pages:doc.pages.map(p=>({id:p.id,layout:p.layout,sections:p.sections.map(s=>({id:s.id,kind:s.kind,enabled:s.enabled,layout:s.layout}))}))});
export function createAgentAccess({store,access,registry,save,audit}){
 store.db.exec('CREATE TABLE IF NOT EXISTS studio_agent_tokens(id TEXT PRIMARY KEY,site_id TEXT NOT NULL REFERENCES studio_sites(id),user_id TEXT NOT NULL REFERENCES users(id),token_hash TEXT NOT NULL UNIQUE,label TEXT NOT NULL,created TEXT NOT NULL,expires INTEGER NOT NULL,revoked INTEGER NOT NULL DEFAULT 0); CREATE TABLE IF NOT EXISTS studio_ai_proposals(id TEXT PRIMARY KEY,site_id TEXT NOT NULL REFERENCES studio_sites(id),token_id TEXT NOT NULL REFERENCES studio_agent_tokens(id),base_revision INTEGER NOT NULL,document TEXT NOT NULL,status TEXT NOT NULL,created TEXT NOT NULL,decision_actor TEXT);');
 function credential(req,siteId){
  const raw=req.headers.authorization;
  if(typeof raw!=='string'||!/^Bearer studio_agent_[A-Za-z0-9_-]{43}$/.test(raw))fail(401,'AI erişim anahtarı gerekli.');
  const token=store.get('SELECT * FROM studio_agent_tokens WHERE token_hash=? AND revoked=0 AND expires>?',hash(raw.slice(7)),Date.now());
  if(!token)fail(401,'AI erişim anahtarı geçersiz veya süresi dolmuş.');
  if(token.site_id!==siteId)fail(403,'AI anahtarı bu site için yetkili değil.');
  const site=access({user_id:token.user_id},siteId,'content');return{token,site};
 }
 function limit(id){
  const key='studio-agent:'+id,now=Date.now(),row=store.get('SELECT * FROM attempts WHERE key=?',key);
  if(row&&row.expires>now&&row.count>=60)fail(429,'AI istek sınırı aşıldı.');
  if(!row||row.expires<=now)store.run('INSERT INTO attempts VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET count=excluded.count,expires=excluded.expires',key,1,now+60000);
  else store.run('UPDATE attempts SET count=count+1 WHERE key=?',key);
 }
 function validate(site,document){
  const shape=validateDocument(document,site.document);if(shape.length)fail(422,'AI çıktı şeması geçersiz.',shape);
  const issues=registry.get(site.adapter).validate(site.document,document,site.source);
  if(issues.length)fail(422,'AI önerisi alan kurallarına uymuyor.',issues);
  if(design(site.document)!==design(document))fail(403,'AI anahtarı yalnızca içerik önerisi hazırlayabilir.');
  const allowed=structuredClone(site.document);
  for(const page of allowed.pages){
   const next=document.pages.find(p=>p.id===page.id);page.title=next.title;page.description=next.description;
   for(const section of page.sections)for(const field of section.fields){const target=next.sections.find(s=>s.id===section.id).fields.find(f=>f.id===field.id);field.value=target.value;if(target.translations)field.translations=target.translations;else delete field.translations;}
  }
  if(!isDeepStrictEqual(allowed,document))fail(403,'AI önerisi alan değerleri, çeviriler ve sayfa SEO metinleriyle sınırlıdır.');
 }
 async function agentRoute({req,res,url,method,body,json}){
  const match=url.pathname.match(/^\/api\/v2\/agent\/sites\/([a-f0-9-]{36})\/(document|proposals)$/);
  if(!match)fail(403,'AI anahtarı bu işlemi yapamaz.');
  const [,siteId,action]=match;let auth=credential(req,siteId);limit(auth.token.id);
  if(action==='document'&&method==='GET'){json(res,200,{document:auth.site.document,revision:auth.site.revision,capabilities:['document:read','proposal:create']});return true;}
  if(action!=='proposals'||method!=='POST')fail(403,'AI anahtarı bu işlemi yapamaz.');
  const input=await body(req);auth=credential(req,siteId);
  if(Object.keys(input).some(key=>!['revision','document'].includes(key)))fail(422,'AI çıktı sözleşmesi yalnızca revision ve document kabul eder.');
  if(input.revision!==auth.site.revision)fail(409,'Site değişti; öneriyi güncel belgeye göre hazırlayın.');
  validate(auth.site,input.document);
  if(store.get("SELECT COUNT(*) n FROM studio_ai_proposals WHERE site_id=? AND status='pending'",siteId).n>=50)fail(429,'Bekleyen AI önerisi sınırı doldu.');
  const id=randomUUID();store.run('INSERT INTO studio_ai_proposals VALUES (?,?,?,?,?,?,?,NULL)',id,siteId,auth.token.id,input.revision,encode(input.document),'pending',new Date().toISOString());
  audit(auth.site,{user_id:auth.token.user_id},'ai.proposal.created',auth.site.revision,{proposalId:id,credentialId:auth.token.id},'ai');
  json(res,201,{id,status:'pending',requiresHumanApproval:true});return true;
 }
 async function humanRoute({req,url,method,user,siteId,action,body,send}){
  if(action==='agent-tokens'){
   access(user,siteId,'members');access(user,siteId,'content');
   if(method==='GET')return send({tokens:store.all('SELECT id,label,created,expires,revoked FROM studio_agent_tokens WHERE site_id=? ORDER BY created DESC',siteId)});
   if(method==='POST'){
    const input=await body(req);const site=access(user,siteId,'members');access(user,siteId,'content');
    if(typeof input.label!=='string'||!input.label.trim()||input.label.length>80||/[\u0000-\u001f<>]/.test(input.label)||!Number.isInteger(input.hours)||input.hours<1||input.hours>24)fail(422,'Anahtar adı ve 1–24 saat geçerlilik gerekli.');
    if(store.get('SELECT COUNT(*) n FROM studio_agent_tokens WHERE site_id=? AND revoked=0 AND expires>?',siteId,Date.now()).n>=10)fail(429,'Site başına en çok 10 etkin AI anahtarı.');
    const raw='studio_agent_'+randomBytes(32).toString('base64url'),id=randomUUID(),expires=Date.now()+input.hours*3600000;
    store.run('INSERT INTO studio_agent_tokens VALUES (?,?,?,?,?,?,?,0)',id,siteId,user.user_id,hash(raw),input.label.trim(),new Date().toISOString(),expires);
    audit(site,user,'ai.credential.created',site.revision,{credentialId:id,expires});
    return send({id,token:raw,expires,capabilities:['document:read','proposal:create']},201);
   }
   if(method==='DELETE'){
    const input=await body(req),site=access(user,siteId,'members');
    if(typeof input.id!=='string'||!/^[a-f0-9-]{36}$/.test(input.id))fail(422,'Anahtar kimliği gerekli.');
    store.transaction(()=>{store.run('UPDATE studio_agent_tokens SET revoked=1 WHERE id=? AND site_id=?',input.id,siteId);store.run("UPDATE studio_ai_proposals SET status='rejected',decision_actor=? WHERE token_id=? AND site_id=? AND status='pending'",user.user_id,input.id,siteId);});
    audit(site,user,'ai.credential.revoked',site.revision,{credentialId:input.id});return send({ok:true});
   }
  }
  if(action==='ai-proposals'&&method==='GET'){
   access(user,siteId,'content');return send({proposals:store.all('SELECT id,token_id,base_revision,document,status,created,decision_actor FROM studio_ai_proposals WHERE site_id=? ORDER BY created DESC LIMIT 100',siteId).map(p=>({...p,document:JSON.parse(p.document)}))});
  }
  const match=action.match(/^ai-proposals\/([a-f0-9-]{36})\/(accept|reject)$/);
  if(match&&method==='POST'){
   const input=await body(req),site=access(user,siteId,'content'),proposal=store.get('SELECT * FROM studio_ai_proposals WHERE id=? AND site_id=?',match[1],siteId);
   if(!proposal)fail(404,'AI önerisi bulunamadı.');if(proposal.status!=='pending')fail(409,'Öneri daha önce sonuçlandırılmış.');
   if(match[2]==='reject'){store.run("UPDATE studio_ai_proposals SET status='rejected',decision_actor=? WHERE id=?",user.user_id,proposal.id);audit(site,user,'ai.proposal.rejected',site.revision,{proposalId:proposal.id});return send({ok:true});}
   const token=store.get('SELECT * FROM studio_agent_tokens WHERE id=? AND revoked=0',proposal.token_id);
   if(!token)fail(403,'Önerinin AI anahtarı iptal edilmiş.');access({user_id:token.user_id},siteId,'content');
   if(input.revision!==site.revision||proposal.base_revision!==site.revision)fail(409,'Öneri eski sürüme ait; farkları inceleyip yeniden hazırlayın.');
   const document=JSON.parse(proposal.document);validate(site,document);
   const result=save(user,siteId,{revision:site.revision,document,actorType:'ai',note:'İnsan tarafından onaylanan AI önerisi'},()=>{
    store.run("UPDATE studio_ai_proposals SET status='accepted',decision_actor=? WHERE id=?",user.user_id,proposal.id);
    audit(site,user,'ai.proposal.accepted',site.revision+1,{proposalId:proposal.id,credentialId:token.id,proposedBy:token.user_id},'human');
   });
   return send({...result,proposalId:proposal.id});
  }
  return false;
 }
 return {agentRoute,humanRoute};
}
