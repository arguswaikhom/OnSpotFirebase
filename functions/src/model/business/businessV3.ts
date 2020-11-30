import { BusinessV2 } from './businessV2';
import { OSRating } from '../osRating';
import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';
import { fieldBusinessRating, fieldOrderRating } from '../../resources/string';
import { BusinessV2a } from './businessV2a';

export class BusinessV3 extends BusinessV2a {
  // todo: complete this class  

  constructor(doc: DocumentSnapshot) {
    super(doc)

  }
}