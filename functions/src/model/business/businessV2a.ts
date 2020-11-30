import { BusinessV2 } from './businessV2';
import { OSRating } from '../osRating';
import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';
import { fieldBusinessRating, fieldOrderRating } from '../../resources/string';

export class BusinessV2a extends BusinessV2 {
  businessRating: OSRating
  orderRating: OSRating

  constructor(doc: DocumentSnapshot) {
    super(doc)
    this.businessRating = doc[fieldBusinessRating]
    this.orderRating = doc[fieldOrderRating]
  }
}