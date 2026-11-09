import {isDeepStrictEqual} from 'node:util';
import {isRuntimeSecretName} from '../security/runtime-files.mjs';
import {fail} from '../util.mjs';
import {claimSourcePath} from './import.ts';
import {validateDocument} from '../../shared/v2/validation.ts';
import type {Adapter,Document,Source} from '../../shared/v2/model.ts';

// Historical records must pass today's content policy before they can become an
// active document or an output. This does not strip arbitrary site source code.
export function assertSnapshot(adapter:Adapter,document:Document,source:Source):void{
 const issues=validateDocument(document,document);
 if(issues.length)fail(422,'Sürüm güncel içerik kurallarına uymuyor; etkin içerik değiştirilmedi.',issues);
 if(!source||!source.files||!source.assets||!Array.isArray(source.bindings)||source.manifest?.adapter?.id!==adapter.id||source.manifest.adapter.version!==adapter.version)fail(422,'Sürümün kaynak veya adaptör sözleşmesi geçersiz.');
 const names=new Set<string>();
 for(const [file,text]of Object.entries(source.files)){claimSourcePath(file,names);if(isRuntimeSecretName(file.split('/').at(-1)))fail(422,'Sürüm çalışma zamanı sırrı içeriyor; güvenli import ile kaynağı yeniden eşleyin.');if(typeof text!=='string')fail(422,'Sürüm kaynak metni geçersiz.');}
 for(const file of Object.keys(source.assets))claimSourcePath(file,names);
 const policy=adapter.validate(document,document,source);
 if(policy.length)fail(422,'Sürüm güncel alan kurallarına uymuyor.',policy);
 // Re-discovery checks source fingerprints and permanent bindings through the
 // adapter contract; a new adapter needs no special case in this boundary.
 const discovered=adapter.discover(source);
 if(!isDeepStrictEqual(document,discovered.document))fail(422,'Sürüm içeriği ile kaynak eşleştirmesi uyuşmuyor.',[{path:'/source',message:'Kaynağı yeniden eşleyin; sürüm doğrudan kullanılamaz.'}]);
}

export function assertRestorable(adapter:Adapter,current:Document,target:Document,source:Source):void{
 assertSnapshot(adapter,target,source);
 const issues=adapter.validate(current,target,source);
 if(issues.length)fail(422,'Bu sürüm değişen alan veya sözlük kurallarıyla geri yüklenemiyor. Mevcut içerik korundu.',issues);
}
