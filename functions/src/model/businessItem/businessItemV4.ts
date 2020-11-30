import { BusinessItemV3 } from './businessItemV3';
import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';
import { fieldImageUrls } from '../../resources/string';

export class BusinessItemV4 extends BusinessItemV3 {
  imageUrls: string[]

  constructor(doc: DocumentSnapshot) {
    super(doc)
    this.imageUrls = doc[fieldImageUrls]
  }
}