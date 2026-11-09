import {defineModule, field, currencyField} from '@loft-studio/sdk';
export default defineModule({
  manifest:{id:'studio.crm',name:'CRM',description:'Kişiler, şirketler, satış fırsatları ve takip aktiviteleri.',version:'1.0.0',apiVersion:1,schemaVersion:1,permissions:['operations']},
  migrations:[{version:1,up(){}}],
  collections:{
    companies:{label:'Şirketler',permission:'operations',fields:{name:field('Şirket adı','text',{required:true,maxLength:160}),website:field('Web sitesi','url',{maxLength:2000}),notes:field('Notlar','textarea',{maxLength:4000})}},
    contacts:{label:'Kişiler',permission:'operations',fields:{name:field('Ad soyad','text',{required:true,maxLength:160}),email:field('E-posta','email',{maxLength:254,normalize:'lowercase',unique:true}),phone:field('Telefon','text',{maxLength:40}),companyId:field('Şirket','reference',{collection:'companies'}),status:field('Durum','enum',{required:true,default:'lead',values:['lead','customer','archived']}),marketingConsent:field('Pazarlama iletişimi izni','boolean',{default:false}),notes:field('Notlar','textarea',{maxLength:4000})}},
    deals:{label:'Satış fırsatları',permission:'operations',fields:{title:field('Fırsat adı','text',{required:true,maxLength:160}),contactId:field('İlgili kişi','reference',{required:true,collection:'contacts'}),stage:field('Aşama','enum',{required:true,default:'new',values:['new','qualified','proposal','won','lost']}),valueMinor:field('Değer (kuruş/cent)','number',{required:true,default:0,min:0,max:100000000000}),currency:currencyField(),expectedClose:field('Beklenen kapanış','date'),notes:field('Notlar','textarea',{maxLength:4000})}},
    activities:{label:'Aktiviteler',permission:'operations',fields:{title:field('Aktivite','text',{required:true,maxLength:160}),contactId:field('İlgili kişi','reference',{required:true,collection:'contacts'}),kind:field('Tür','enum',{required:true,default:'task',values:['task','call','meeting','note']}),due:field('Takip tarihi','date'),done:field('Tamamlandı','boolean',{default:false}),notes:field('Notlar','textarea',{maxLength:4000})}}
  },
  commands:{
    pipeline:{label:'Satış özetini göster',permission:'operations',write:false,run(ctx){
      const stages={};let offset=0,total;
      do{const batch=ctx.records.list('deals',{limit:500,offset});total=batch.total;for(const {data:d}of batch.items){const key=d.stage+':'+d.currency;stages[key]||={stage:d.stage,currency:d.currency,count:0,valueMinor:0};stages[key].count++;stages[key].valueMinor+=d.valueMinor;}offset+=batch.items.length;}while(offset<total);
      return {stages:Object.values(stages),contacts:ctx.records.list('contacts',{limit:1}).total};
    }}
  }
});
