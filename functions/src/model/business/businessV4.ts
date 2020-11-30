import { BusinessV2 } from './businessV2';
import { OSRating } from '../osRating';
import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';
import { fieldBusinessRating, fieldOrderRating, fieldImageUrls } from '../../resources/string';
import { BusinessV3 } from './businessV3';

export class BusinessV4 extends BusinessV3 {
  imageUrls: []


  constructor(doc: DocumentSnapshot) {
    super(doc)
    this.imageUrls = doc[fieldImageUrls]
  }
}