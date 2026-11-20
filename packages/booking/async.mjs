import {defineAsyncModule} from '@loft-studio/sdk';
import {createBookingModule,ensureBookingSite} from './index.mjs';

/** Operational data stays in its authoritative store; no distributed rollback. */
export function createAsyncBookingModule({booking,store}) {
 const legacy=createBookingModule({booking,store});
 const module=defineAsyncModule({
  manifest:{...legacy.manifest,apiVersion:2},collections:{},migrations:legacy.migrations,
  events:legacy.events,ports:['booking.operations'],
  commands:Object.fromEntries(Object.entries(legacy.commands).map(([name,c])=>[name,{...c,port:'booking.operations',run:async(_ctx,input)=>({operation:name,input})}]))
 });
 return {module,
  async provision(site){ensureBookingSite(store,site);},
  async invoke({actor,site},payload){ensureBookingSite(store,site);return await legacy.commands[payload.operation].run({actor,site},payload.input);},
  source:{async read(after,limit){return await legacy.eventSource.read(after,limit);}},
  async exportData({actor,site}){return await legacy.exportData({actor,site});}
 };
}
