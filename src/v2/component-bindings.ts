import {validateComponentBindings} from '../../packages/sdk/components.mjs';
import {fail} from '../util.mjs';
import type {Document,Source} from '../../shared/v2/model.ts';
export function componentBindings(document:Document,source:Source){
 const raw=source.files['studio/components.json'];if(raw===undefined)return null;
 if(source.manifest.adapter.id!=='react-sdk')fail(422,'Bileşen bağları React SDK adaptörü gerektirir.');
 let data;try{data=JSON.parse(raw);}catch{fail(422,'Bileşen bağları geçerli JSON değil.');}
 const manifest=validateComponentBindings(document,data);
 for(const c of manifest.components)if(typeof source.files[c.sourceFile]!=='string')fail(422,'Bildirilen bileşen kaynak dosyası bulunamadı.');
 return manifest;
}
