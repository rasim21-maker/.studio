import {escapeHtml} from '../public/rich-core.js';
export const themes = {
 original:['Özgün Loft','#ffffff','#171717','#f6d434','#f5f5ef'], warm:['Sıcak','#fff9ef','#382d22','#e8bd64','#f5ead9'], forest:['Orman','#f3f7ed','#244338','#c1d986','#e4edde'], midnight:['Gece mavisi','#f4f6fb','#252b48','#aeb9ee','#e7eaf4'],
 ocean:['Okyanus','#f0f9fb','#123e52','#8bd8e7','#dff0f5'], rose:['Gül','#fff5f6','#512a39','#efb5c3','#f7e4e9'], terracotta:['Terrakota','#fff7f0','#543527','#edb08b','#f2e4d9'], lavender:['Lavanta','#f8f5ff','#3c3159','#c9b6ed','#ede6f7'], mint:['Nane','#f1fcf7','#214c41','#9de0bd','#def2e7'], editorial:['Editoryal','#faf9f6','#252523','#d4d0c2','#edebe5'], citrus:['Narenciye','#fefff0','#374125','#dcdf7a','#f1f3d9'], slate:['Arduvaz','#f4f7f9','#283c4b','#a8c6d7','#e4ecf1']
};
export const layoutDefaults={mode:'stack',columns:2,gap:24,paddingTop:32,paddingBottom:32,paddingInline:24,maxWidth:1200,align:'stretch',autoAlign:true,mobileGap:16,mobilePadding:16};
export const sectionDefaults={align:'stretch',vertical:'start',span:1,padding:0,marginTop:0,marginBottom:0,textAlign:'inherit'};
export const templates={
 original:{name:'Özgün düzen',layout:null}, spacious:{name:'Geniş tek sütun',layout:{...layoutDefaults,gap:48,maxWidth:1100}},
 cards:{name:'İki sütun kartlar',layout:{...layoutDefaults,mode:'grid',columns:2,gap:24}}, magazine:{name:'Üç sütun dergi',layout:{...layoutDefaults,mode:'grid',columns:3,gap:24}}, sidebar:{name:'İçerik + yan panel',layout:{...layoutDefaults,mode:'sidebar',columns:2}}, compact:{name:'Kompakt içerik',layout:{...layoutDefaults,gap:12,paddingTop:16,paddingBottom:16,maxWidth:960}}, landing:{name:'Geniş karşılama',layout:{...layoutDefaults,gap:64,maxWidth:1440,paddingTop:48,paddingBottom:48}}
};
export function validateDesign(layout, section=false){
 if(layout===undefined||layout===null)return true;if(typeof layout!=='object'||Array.isArray(layout))return false;
 const defs=section?sectionDefaults:layoutDefaults;
 const options=section?{align:['stretch','left','center','right'],vertical:['start','center','end'],textAlign:['inherit','left','center','right','justify']}:{mode:['stack','grid','sidebar'],align:['stretch','left','center','right']};
 return Object.entries(layout).every(([k,v])=>Object.hasOwn(defs,k)&&(options[k]?options[k].includes(v):k==='autoAlign'?typeof v==='boolean':Number.isInteger(v)&&v>=(k==='maxWidth'?320:k==='columns'||k==='span'?1:0)&&v<=(k==='maxWidth'?1800:k==='columns'||k==='span'?3:160)));
}
export function designCss(structure){
 let css='';
 for(const page of structure.pages){
  if(page.layout){const l={...layoutDefaults,...page.layout},sel=`[data-studio-page="${page.id}"]`;
   css+=`${sel}{box-sizing:border-box;display:grid;grid-template-columns:${l.mode==='grid'?`repeat(${l.columns},minmax(0,1fr))`:l.mode==='sidebar'?'minmax(0,2fr) minmax(0,1fr)':'minmax(0,1fr)'};gap:${l.gap}px;padding:${l.paddingTop}px ${l.paddingInline}px ${l.paddingBottom}px;max-width:${l.maxWidth}px;margin-inline:auto;align-items:start;justify-items:${{stretch:'stretch',left:'start',center:'center',right:'end'}[l.align]}}${sel}>*{min-width:0;max-width:100%;box-sizing:border-box;width:100%}${sel}>.wrap{padding-inline:0;margin:0}${sel} img,${sel} video,${sel} iframe{max-width:100%;height:auto}${sel} .hero,${sel} .split{grid-template-columns:minmax(0,1fr)}${sel} .hero-visual{min-width:0}`;
   if(l.autoAlign)css+=`@media(max-width:900px){${sel}{grid-template-columns:minmax(0,1fr);gap:${l.mobileGap}px;padding-inline:${l.mobilePadding}px}${sel}>*{grid-column:auto!important;justify-self:stretch!important;width:100%!important;overflow-wrap:anywhere}}`;
  }
  for(const section of page.sections){if(!section.layout)continue;const s={...sectionDefaults,...section.layout},sel=`[data-studio-page="${page.id}"]>[data-studio-section="${section.id}"]`;css+=`${sel}{box-sizing:border-box;grid-column:span ${Math.min(s.span,page.layout?.mode==='grid'?page.layout.columns||2:page.layout?.mode==='sidebar'?2:1)};justify-self:${{stretch:'stretch',left:'start',center:'center',right:'end'}[s.align]};align-self:${s.vertical};padding:${s.padding}px;margin-top:${s.marginTop}px;margin-bottom:${s.marginBottom}px;text-align:${s.textAlign};${s.align==='stretch'?'':`width:85%;max-width:100%;margin-inline:${{left:'0 auto',center:'auto',right:'auto 0'}[s.align]};`}}`;if(!page.layout)css+=`@media(max-width:900px){${sel}{width:100%;max-width:100%;margin-inline:0;overflow-wrap:anywhere}}`;}
 }
 return css+'\n.rt-align-left,.rt-align-center,.rt-align-right,.rt-align-justify{display:block}.rt-align-left{text-align:left}.rt-align-center{text-align:center}.rt-align-right{text-align:right}.rt-align-justify{text-align:justify}';
}
export function themeCss(theme){if(theme.preset==='original')return '';const [,paper,ink,lime,surface]=themes[theme.preset];return `:root:not([data-theme=dark]){--paper:${paper};--ink:${ink};--green:${ink};--lime:${lime};--surface:${surface};--card:${paper};--header-bg:${paper}fa}`;}
export const safeSectionId=id=>escapeHtml(id);
