import {defineModule,field,currencyField,fail} from '@loft-studio/sdk';
const money=label=>field(label,'number',{required:true,min:0,max:100000000000,default:0});
const lines=field('Sipariş kalemleri','items',{required:true,minItems:1,maxItems:50,fields:{productId:field('Ürün','reference',{required:true,collection:'products'}),quantity:field('Adet','number',{required:true,min:1,max:10000,default:1})}});
export default defineModule({
  manifest:{id:'studio.commerce',name:'E-ticaret',description:'Ürün, stok ve manuel sipariş yönetimi. Çevrimiçi tahsilat, vergi ve kargo sağlayıcıları bu pakette etkin değildir.',version:'1.0.0',apiVersion:1,schemaVersion:1,permissions:['operations']},
  migrations:[{version:1,up(){}}],
  collections:{
    products:{label:'Ürünler',permission:'operations',fields:{name:field('Ürün adı','text',{required:true,maxLength:160}),sku:field('Stok kodu','text',{required:true,maxLength:80,normalize:'lowercase',unique:true}),description:field('Açıklama','textarea',{maxLength:4000}),priceMinor:money('Birim fiyat (kuruş/cent)'),currency:currencyField(),stock:field('Satılabilir stok','number',{required:true,min:0,max:1000000,default:0}),active:field('Satışa açık','boolean',{default:false})}},
    orders:{label:'Siparişler',permission:'operations',readOnly:true,fields:{requestId:field('Tekil istek anahtarı','text',{required:true,maxLength:80,unique:true}),customerName:field('Müşteri','text',{required:true,maxLength:160}),customerEmail:field('E-posta','email',{required:true,maxLength:254}),currency:currencyField(),totalMinor:money('Toplam (kuruş/cent)'),status:field('Durum','enum',{required:true,values:['pending','fulfilled','cancelled']}),paymentStatus:field('Ödeme durumu','enum',{required:true,values:['unpaid']}),notes:field('Notlar','textarea',{maxLength:4000}),items:field('Kalemler','items',{required:true,minItems:1,maxItems:50,fields:{...lines.fields,name:field('Ürün adı','text',{required:true,maxLength:160}),sku:field('Stok kodu','text',{required:true,maxLength:80}),unitPriceMinor:money('Birim fiyat')}})}},
  },
  commands:{
    createOrder:{label:'Manuel sipariş oluştur',help:'Stok atomik olarak düşer. Fiyatlar sunucudaki katalogdan alınır; ödeme alınmış sayılmaz. Aynı istek anahtarı tekrar sipariş üretmez.',permission:'operations',fields:{requestId:field('Tekil istek anahtarı','text',{required:true,maxLength:80,generate:'uuid'}),customerName:field('Müşteri adı','text',{required:true,maxLength:160}),customerEmail:field('E-posta','email',{required:true,maxLength:254,normalize:'lowercase'}),items:lines,notes:field('Notlar','textarea',{maxLength:4000})},
      run(ctx,input){return ctx.transaction(()=>{
        const previous=ctx.records.find('orders','requestId',input.requestId);
        if(previous){const identity=v=>JSON.stringify({customerName:v.customerName,customerEmail:v.customerEmail,notes:v.notes||'',items:v.items.map(i=>({productId:i.productId,quantity:i.quantity}))});if(identity(previous.data)!==identity(input))fail(409,'Bu istek anahtarı başka bir siparişte kullanıldı.');return previous;}
        const seen=new Set(),items=[];let currency,totalMinor=0;
        for(const line of input.items){
          if(seen.has(line.productId))fail(422,'Aynı ürünü tek satırda belirtin.');seen.add(line.productId);
          const product=ctx.records.get('products',line.productId),p=product.data;
          if(!p.active||p.stock<line.quantity)fail(409,p.name+': yeterli satılabilir stok yok.');
          if(currency&&currency!==p.currency)fail(422,'Siparişteki ürünlerin para birimi aynı olmalı.');currency=p.currency;
          totalMinor+=p.priceMinor*line.quantity;if(!Number.isSafeInteger(totalMinor)||totalMinor>100000000000)fail(422,'Sipariş tutarı sınırı aşıldı.');
          items.push({...line,name:p.name,sku:p.sku,unitPriceMinor:p.priceMinor});
          ctx.records.put('products',{id:product.id,revision:product.revision,data:{...p,stock:p.stock-line.quantity}});
        }
        const order=ctx.records.put('orders',{data:{...input,items,currency,totalMinor,status:'pending',paymentStatus:'unpaid'}});
        ctx.emit('order.created',{orderId:order.id,totalMinor,currency});return order;
      });}},
    transition:{label:'Sipariş durumunu değiştir',permission:'operations',fields:{id:field('Sipariş kimliği','reference',{required:true,collection:'orders'}),revision:field('Güncel sürüm','number',{required:true,min:0}),status:field('Yeni durum','enum',{required:true,values:['fulfilled','cancelled']})},run(ctx,input){return ctx.transaction(()=>{
      const order=ctx.records.get('orders',input.id);if(order.revision!==input.revision)fail(409,'Sipariş sürümü değişti.');if(order.data.status!=='pending')fail(409,'Kapanmış sipariş yeniden değiştirilemez.');
      if(input.status==='cancelled')for(const line of order.data.items){const p=ctx.records.get('products',line.productId);ctx.records.put('products',{id:p.id,revision:p.revision,data:{...p.data,stock:p.data.stock+line.quantity}});}
      const result=ctx.records.put('orders',{id:order.id,revision:order.revision,data:{...order.data,status:input.status}});ctx.emit('order.'+input.status,{orderId:order.id});return result;
    });}}
  }
});
