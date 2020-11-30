import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';
import * as str from '../../resources/string';
import { OSReviewV1 } from './osReviewV1';

export class OSRUItemByCustomer extends OSReviewV1 {
  item: string
  business: string
  customer: string

  constructor(doc: DocumentSnapshot) {
    super(doc)
    this.item = doc[str.fieldItem]
    this.business = doc[str.fieldBusiness]
    this.customer = doc[str.fieldCustomer]
  }
}