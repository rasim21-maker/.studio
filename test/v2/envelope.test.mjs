import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {sealSecret,openSecret,rewrapSecret,localKeyProvider,maxSecretBytes} from '../../src/security/envelope.mjs';
import {openLocalKeyProvider} from '../../src/security/local-keys.mjs';

test('E-06: envelope binds credentials to their tenant context and authenticates ciphertext',async()=>{
 const provider=localKeyProvider('first',{first:randomBytes(32)}),secret={token:'fixture-secret-only'},context='org:one:connector:github';
 const encoded=await sealSecret(secret,context,provider);assert.ok(!encoded.includes(secret.token));
 assert.deepEqual(await openSecret(encoded,context,provider),secret);
 await assert.rejects(()=>openSecret(encoded,'org:two:connector:github',provider),/authentication/);
 const corrupt=JSON.parse(encoded);corrupt.payload.data=Buffer.alloc(20).toString('base64');
 await assert.rejects(()=>openSecret(JSON.stringify(corrupt),context,provider),/authentication/);
 await assert.rejects(()=>openSecret(encoded,context,localKeyProvider('first',{first:randomBytes(32)})),/authentication/);
});
test('E-06: wrapping-key rotation retains payload and requires the new key',async()=>{
 const previous=localKeyProvider('one',{one:randomBytes(32)}),next=localKeyProvider('two',{two:randomBytes(32)}),context='org:one:connector:wordpress';
 const before=await sealSecret({password:'test-only'},context,previous),after=await rewrapSecret(before,context,previous,next);
 assert.deepEqual(JSON.parse(after).payload,JSON.parse(before).payload);
 assert.deepEqual(await openSecret(after,context,next),{password:'test-only'});
 await assert.rejects(()=>openSecret(after,context,previous));
 assert.deepEqual(await openSecret(before,context,previous),{password:'test-only'});
});
test('E-06: local wrapping keys persist across restarts without appearing in envelopes',async()=>{
 await fs.mkdir('test-results',{recursive:true});const dir=await fs.mkdtemp(path.resolve('test-results/keys-'));
 const first=await openLocalKeyProvider(dir),encoded=await sealSecret({token:'fixture'},'context',first),second=await openLocalKeyProvider(dir);
 assert.deepEqual(await openSecret(encoded,'context',second),{token:'fixture'});
 const file=JSON.parse(await fs.readFile(path.join(dir,'studio-vault.json'),'utf8'));
 for(const key of Object.values(file.keys))assert.ok(!encoded.includes(key));
});

test('E-06: oversized secret payloads are rejected before producing an unreadable envelope',async()=>{
 const provider=localKeyProvider('test',{test:randomBytes(32)}),value='a'.repeat(maxSecretBytes-2);
 const encoded=await sealSecret(value,'fixture',provider);assert.equal(await openSecret(encoded,'fixture',provider),value);
 await assert.rejects(()=>sealSecret(value+'x','fixture',provider),/size limit/);
});
