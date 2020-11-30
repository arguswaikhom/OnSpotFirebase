import { OSPrice } from '../osPrice';
import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';
import { fieldPrice } from '../../resources/string';
import { BusinessItemV0 } from './businessItemV0';

export class BusinessItemV1 extends BusinessItemV0 {
  price: OSPrice

  constructor(doc: DocumentSnapshot) {
    super(doc)
    this.price = doc[fieldPrice]
  }
}