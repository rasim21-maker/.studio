import legacy from './index.mjs';
export default {...legacy,manifest:{...legacy.manifest,apiVersion:2},commands:{
 ...legacy.commands,pipeline:{...legacy.commands.pipeline,async run(ctx){
  const stages={};let offset=0,total;
  do{const batch=await ctx.records.list('deals',{limit:500,offset});total=batch.total;
   for(const {data:d}of batch.items){const key=d.stage+':'+d.currency;stages[key]||={stage:d.stage,currency:d.currency,count:0,valueMinor:0};stages[key].count++;stages[key].valueMinor+=d.valueMinor;}offset+=batch.items.length;
  }while(offset<total);
  return {stages:Object.values(stages),contacts:(await ctx.records.list('contacts',{limit:1})).total};
 }}
}};
