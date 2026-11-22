export function selectionKey(event:{source:unknown;origin:string;data:any},frame:unknown,channel:string,keys:string[]):string|null{
 const d=event.data;
 if(!frame||event.source!==frame||event.origin!=='null'||!d||typeof d!=='object'||Array.isArray(d)||Object.keys(d).sort().join(',')!=='channel,key,type,version'||d.type!=='studio.pick'||d.version!==1||d.channel!==channel||typeof d.key!=='string'||!keys.includes(d.key))return null;
 return d.key;
}
