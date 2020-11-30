import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';
import * as str from '../../resources/string';

export class BusinessV0 {
  businessId: string
  businessRefId: string
  displayName: string
  imageUrl: string

  constructor(doc: DocumentSnapshot) {
    this.businessId = doc[str.fieldBusinessId]
    this.businessRefId = doc[str.fieldBusinessRefId]
    this.displayName = doc[str.fieldDisplayName]
    this.imageUrl = doc[str.fieldImageUrl]
  }
}