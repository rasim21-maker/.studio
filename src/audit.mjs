// Loft composition adapter. The audit package does not import business modules.
import {AuditLog, manifest, csvColumns, csvRow} from '@loft-studio/audit';
import {setImmediate as yieldLoop} from 'node:timers/promises';
import {fail} from './util.mjs';

export function createAuditModule({store,platform,trustedProxies=[],operatorIds=[]}) {
  const log=new AuditLog({db:store.db,trustedProxies,onFailure:()=>console.error('AUDIT_WRITE_FAILED'),resolveScope:(path,user)=>{
    const site=path.match(/^\/(?:api\/(?:v2\/(?:agent\/)?sites|sites)|public|payments|preview|assets|book)\/([a-zA-Z0-9-]{1,80})(?:\/|$)/);
    return site?'site:'+site[1]:user?'account:'+(user.user_id||user.id):'system';
  }});
  store.audit=log;
  store.db.exec('CREATE TABLE IF NOT EXISTS studio_log_operators(user_id TEXT PRIMARY KEY); CREATE TABLE IF NOT EXISTS studio_log_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);');
  const scoped=(table,scope,extra={})=>log.track({table,scope,...extra});
  const site=a=>"'site:'||"+a+'.site_id';
  for(const table of ['drafts','structures','memberships','booking_settings','reservations','calendar_events','integrations',
    'studio_members','studio_connections','studio_releases','studio_regional_settings','studio_agent_tokens','studio_ai_proposals',
    'studio_module_installations','studio_module_records','studio_integration_records','studio_integration_references'])scoped(table,site);
  for(const table of ['sites','studio_sites'])scoped(table,a=>"'site:'||"+a+'.id');
  for(const table of ['users'])scoped(table,a=>"'account:'||"+a+'.id');
  scoped('sessions',a=>"'account:'||"+a+'.user_id',{columns:['user_id','expires']});
  scoped('external_identities',a=>"'account:'||"+a+'.user_id',{columns:['provider','user_id','created']});
  scoped('studio_orgs',a=>"'org:'||"+a+'.id');
  scoped('studio_workspaces',a=>"'org:'||"+a+'.org_id');
  scoped('studio_projects',a=>"'org:'||(SELECT org_id FROM studio_workspaces WHERE id="+a+'.workspace_id)');
  scoped('studio_imports',a=>"CASE WHEN "+a+".site_id IS NOT NULL THEN 'site:'||"+a+".site_id ELSE 'org:'||"+a+'.org_id END',
    {columns:['id','owner','org_id','site_id','expected','status','progress','error','created']});
  scoped('builds',site,{columns:['id','site_id','kind','actor','created','status','result','error']});
  scoped('payment_transactions',site,{columns:['id','site_id','booking_id','provider','amount','currency','status','created','updated']});
  scoped('reservation_participants',a=>"'site:'||(SELECT site_id FROM reservations WHERE id="+a+'.booking_id)');
  scoped('events',a=>"CASE WHEN "+a+".site_id IS NULL THEN COALESCE(loft_log_context('scope'),'system') ELSE 'site:'||"+a+'.site_id END',
    {kind:'event',action:a=>a+'.action'});
  scoped('studio_audit',a=>"CASE WHEN "+a+".site_id IS NULL THEN 'org:'||"+a+".org_id ELSE 'site:'||"+a+'.site_id END',
    {kind:'event',action:a=>a+'.action'});
  scoped('studio_module_events',site,{kind:'event',action:a=>a+'.type'});
  scoped('studio_event_deliveries',a=>"'site:'||(SELECT site_id FROM studio_event_outbox WHERE id="+a+'.event_id)');
  scoped('studio_log_operators',()=>"'system'");
  // Bootstrap once for existing installations; never make every site admin an operator.
  function grantInitialOperator(id) {
    if(store.get("SELECT value FROM studio_log_settings WHERE key='bootstrapped'"))return;
    store.run('INSERT OR IGNORE INTO studio_log_operators VALUES (?)',id);
    store.run("INSERT INTO studio_log_settings VALUES ('bootstrapped','1')");
  }
  const first=store.get("SELECT u.id FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.site_id='loft' AND m.role='admin' ORDER BY u.created,u.id LIMIT 1");
  if(first)store.transaction(()=>grantInitialOperator(first.id));
  for(const id of operatorIds){if(typeof id!=='string'||id.length>100||!store.get('SELECT id FROM users WHERE id=?',id))throw Error('Unknown audit operator id.');store.run('INSERT OR IGNORE INTO studio_log_operators VALUES (?)',id);}
  const operator=user=>!!store.get('SELECT user_id FROM studio_log_operators WHERE user_id=?',user.user_id);
  function authorize(user,scope,exporting=false) {
    if(user.token_hash&&!store.get('SELECT user_id FROM sessions WHERE token_hash=? AND user_id=? AND expires>?',user.token_hash,user.user_id,Date.now()))fail(401,'Oturum sona erdi.');
    if(operator(user))return;
    if(scope==='account:'+user.user_id)return;
    if(scope?.startsWith('org:')){if(store.get('SELECT id FROM studio_orgs WHERE id=? AND owner=?',scope.slice(4),user.user_id))return;}
    if(scope?.startsWith('site:')) {
      const id=scope.slice(5);
      if(store.get('SELECT id FROM studio_sites WHERE id=?',id)){platform.access(user,id,'audit');if(exporting)platform.access(user,id,'auditExport');return;}
      return store.membership(user.user_id,id,'admin');
    }
    fail(403,'Bu kayıt kapsamına erişiminiz yok.');
  }
  function scopes(user) {
    const result=[{id:'account:'+user.user_id,label:'Kendi hesabım',canExport:true}];
    if(operator(user))result.unshift({id:'*',label:'Tüm kurulum · işletmeci',canExport:true},{id:'system',label:'Girişler ve sistem',canExport:true});
    for(const org of store.all('SELECT id,name FROM studio_orgs WHERE owner=?',user.user_id))result.push({id:'org:'+org.id,label:org.name+' · kurum',canExport:true});
    for(const site of store.all('SELECT id,name FROM studio_sites'))try{
      authorize(user,'site:'+site.id);let canExport=true;try{authorize(user,'site:'+site.id,true);}catch{canExport=false;}
      result.push({id:'site:'+site.id,label:site.name,canExport});
    }catch{}
    for(const site of store.all("SELECT s.id,s.metadata FROM sites s JOIN memberships m ON s.id=m.site_id WHERE m.user_id=? AND m.role='admin' AND NOT EXISTS(SELECT 1 FROM studio_sites v WHERE v.id=s.id)",user.user_id))result.push({id:'site:'+site.id,label:JSON.parse(site.metadata).name||site.id,canExport:true});
    return result;
  }
  async function route({req,res,url,user,method,json}) {
    if(!url.pathname.startsWith('/api/audit/'))return false;
    if(method!=='GET')fail(405,'Kayıtlar salt okunurdur.');
    if(url.pathname==='/api/audit/scopes'){const available=scopes(user);log.setScope('account:'+user.user_id);json(res,200,{manifest,scopes:available});return true;}
    if(!['/api/audit/events','/api/audit/export'].includes(url.pathname))fail(404,'Log işlemi bulunamadı.');
    const exporting=url.pathname.endsWith('/export'),scope=url.searchParams.get('scope');
    authorize(user,scope,exporting);log.setScope(scope);
    const parameters=Object.fromEntries(url.searchParams),{scope:ignored,format='json',limit='50',...filters}=parameters;
    const page=log.query(scope,filters,exporting?200:Number(limit));
    if(!exporting){log.record({action:'audit.view',scope,detail:{filters,count:page.entries.length}});json(res,200,page);return true;}
    if(!['json','csv'].includes(format))fail(422,'JSON veya CSV seçin.');
    log.record({action:'audit.export.started',scope,detail:{format,filters,asOf:page.asOf}});
    res.writeHead(200,{'Content-Type':format==='csv'?'text/csv; charset=utf-8':'application/json; charset=utf-8',
      'Content-Disposition':'attachment; filename="studio-audit.'+format+'"','X-Audit-Snapshot':String(page.asOf)});
    const started=Date.now();let count=0,bytes=0,first=true,current=page;
    const write=async chunk=>{
      bytes+=Buffer.byteLength(chunk);if(bytes>100*1024*1024||Date.now()-started>60_000)fail(413,'Dışa aktarım sınırı; tarih aralığını daraltın.');
      if(res.destroyed)throw Error('Export disconnected');
      if(!res.write(chunk))await new Promise((resolve,reject)=>{
        const cleanup=()=>{res.off('drain',drained);res.off('close',closed);res.off('error',failed);};
        const drained=()=>{cleanup();resolve();},closed=()=>{cleanup();reject(Error('Export disconnected'));},failed=err=>{cleanup();reject(err);};
        res.once('drain',drained);res.once('close',closed);res.once('error',failed);
      });
    };
    try {
      await write(format==='csv'?'\uFEFF'+csvColumns.join(',')+'\r\n':'{"asOf":'+page.asOf+',"entries":[');
      while(true){
        authorize(user,scope,true);
        for(const entry of current.entries){await write(format==='csv'?csvRow(entry):(first?'':',')+JSON.stringify(entry));first=false;count++;}
        if(!current.nextCursor)break;
        await yieldLoop();current=log.query(scope,{...filters,asOf:page.asOf,before:current.nextCursor},200);
      }
      authorize(user,scope,true);
      if(format==='json')await write('],"complete":true,"count":'+count+'}');
      log.record({action:'audit.export.completed',scope,detail:{format,count,asOf:page.asOf}});res.end();
    } catch(error) {
      log.record({action:'audit.export.failed',scope,detail:{format,count,reason:error.status?'limit-or-permission':'interrupted'}});
      res.destroy();
    }
    return true;
  }
  return {log,route,authorize,scopes,grantInitialOperator,manifest};
}
