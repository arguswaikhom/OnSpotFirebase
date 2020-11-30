import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';
import * as str from '../../resources/string'

export class BusinessItemV0 {
  itemId: string
  itemName: string
  businessRefId: string

  constructor(doc: DocumentSnapshot) {
    this.itemId = doc[str.fieldItemId]
    this.itemName = doc[str.fieldItemName]
    this.businessRefId = doc[str.fieldBusinessRefId]
  }
}