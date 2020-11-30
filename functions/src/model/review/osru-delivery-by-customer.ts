import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';
import * as str from '../../resources/string';
import { OSReviewV1 } from './osReviewV1';

export class OSRUDeliveryByCustomer extends OSReviewV1 {
  customer: string;
  delivery: string;
  order: string;
  business: string;

  constructor(doc: DocumentSnapshot) {
    super(doc)
    this.customer = doc[str.fieldCustomer]
    this.delivery = doc[str.fieldDelivery]
    this.order = doc[str.fieldOrder]
    this.business = doc[str.fieldBusiness]
  }
}