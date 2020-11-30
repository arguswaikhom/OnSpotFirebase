import { BusinessItemV2 } from './businessItemV2';
import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';
import * as str from '../../resources/string'

export class BusinessItemV3 extends BusinessItemV2 {
  onStock: number
  status: string

  constructor(doc: DocumentSnapshot) {
    super(doc)
    this.onStock = doc[str.fieldOnStock]
    this.status = doc[str.fieldStatus]
  }
}