import legacy from './index.mjs';
import {fail} from '@loft-studio/sdk';
export default {...legacy,manifest:{...legacy.manifest,apiVersion:2},commands:{
 createOrder:{...legacy.commands.createOrder,async run(ctx,input){return ctx.transaction(async tx=>{
  const previous=await tx.records.find('orders','requestId',input.requestId);
  if(previous){const identity=v=>JSON.stringify({customerName:v.customerName,customerEmail:v.customerEmail,notes:v.notes||'',items:v.items.map(i=>({productId:i.productId,quantity:i.quantity}))});if(identity(previous.data)!==identity(input))fail(409,'Request ID belongs to another order.');return previous;}
  const seen=new Set(),items=[];let currency,totalMinor=0;
  for(const line of input.items){
   if(seen.has(line.productId))fail(422,'Duplicate product.');seen.add(line.productId);
   const product=await tx.records.get('products',line.productId),p=product.data;
   if(!p.active||p.stock<line.quantity)fail(409,'Insufficient stock.');
   if(currency&&currency!==p.currency)fail(422,'Currency mismatch.');currency=p.currency;
   totalMinor+=p.priceMinor*line.quantity;if(!Number.isSafeInteger(totalMinor)||totalMinor>100000000000)fail(422,'Amount exceeds limit.');
   items.push({...line,name:p.name,sku:p.sku,unitPriceMinor:p.priceMinor});
   await tx.records.put('products',{id:product.id,revision:product.revision,data:{...p,stock:p.stock-line.quantity}});
  }
  const order=await tx.records.put('orders',{data:{...input,items,currency,totalMinor,status:'pending',paymentStatus:'unpaid'}});
  await tx.emit('order.created',{orderId:order.id,totalMinor,currency});return order;
 });}},
 transition:{...legacy.commands.transition,async run(ctx,input){return ctx.transaction(async tx=>{
  const order=await tx.records.get('orders',input.id);if(order.revision!==input.revision||order.data.status!=='pending')fail(409,'Order cannot be changed.');
  if(input.status==='cancelled')for(const line of order.data.items){const p=await tx.records.get('products',line.productId);await tx.records.put('products',{id:p.id,revision:p.revision,data:{...p.data,stock:p.data.stock+line.quantity}});}
  const result=await tx.records.put('orders',{id:order.id,revision:order.revision,data:{...order.data,status:input.status}});
  await tx.emit('order.'+input.status,{orderId:order.id});return result;
 });}}
}};
