import { OSRating } from '../osRating';
import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';
import { UserV2 } from './userV2';
import { fieldCustomerRating, fieldDeliveryRating } from '../../resources/string';

export class UserV3 extends UserV2 {
  customerRating: OSRating
  deliveryRating: OSRating

  constructor(doc: DocumentSnapshot) {
    super(doc)
    this.customerRating = doc[fieldCustomerRating]
    this.deliveryRating = doc[fieldDeliveryRating]
  }
}