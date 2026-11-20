// Trusted, deployment-time composition. Add reviewed external packages here.
import {createAsyncBookingModule} from '@loft-studio/booking/async';
import seo from '@loft-studio/seo/async';
import crm from '@loft-studio/crm/async';
import commerce from '@loft-studio/commerce/async';
import bookingCrm from '@loft-studio/booking-crm/async';
export const studioIntegrations = [bookingCrm];
export default ({store, features}) => {
 const booking=createAsyncBookingModule({store,booking:features.booking});
 return [Object.assign(booking.module,{bindings:{ports:{'booking.operations':booking.invoke},source:booking.source,provision:booking.provision,exportData:booking.exportData}}),seo,crm,commerce];
};
