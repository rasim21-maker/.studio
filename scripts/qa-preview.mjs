import path from 'node:path';
import {createApp} from '../src/server.mjs';
import {passwordHash} from '../src/auth.mjs';
const port=4321,origin='http://127.0.0.1:'+port;
const app=await createApp({origin,dataDir:path.resolve('test-results/ui-preview')});
if(!app.store.get("SELECT id FROM users WHERE id='qa'")){
 app.store.run('INSERT INTO users VALUES (?,?,?,?)','qa','preview@studio.test',await passwordHash('Studio-preview-only-2026!'),new Date().toISOString());
 app.store.run('INSERT INTO memberships VALUES (?,?,?)','qa','loft','admin');
}
app.server.listen(port,'127.0.0.1',()=>console.log('V2 isolated QA preview: '+origin+'/v2/'));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await app.close();process.exit(0);});
