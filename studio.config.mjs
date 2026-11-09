// Trusted, deployment-time composition. Add reviewed external packages here.
import {createBookingModule} from '@loft-studio/booking';
import seo from '@loft-studio/seo';
import crm from '@loft-studio/crm';
import commerce from '@loft-studio/commerce';
export default ({store, features}) => [
  createBookingModule({store, booking:features.booking}), seo, crm, commerce
];
