import { BusinessItemV1 } from './businessItemV1';
import { OSRating } from '../osRating';
import * as str from '../../resources/string'
import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';

export class BusinessItemV2 extends BusinessItemV1 {
  category: string
  description: string
  imageUrl: string
  rating: OSRating

  constructor(doc: DocumentSnapshot) {
    super(doc)
    this.category = doc[str.fieldCategory]
    this.description = doc[str.fieldDescription]
    this.imageUrl = doc[str.fieldImageUrl]
    this.rating = doc[str.fieldRating]
  }
}