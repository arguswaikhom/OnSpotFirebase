import { BusinessV0 } from './businessV0';
import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';
import * as str from '../../resources/string'

export class BusinessV1 extends BusinessV0 {
  mobileNumber: string
  website: string
  email: string

  constructor(doc: DocumentSnapshot) {
    super(doc)
    this.mobileNumber = doc[str.fieldMobileNumber]
    this.website = doc[str.fieldWebsite]
    this.email = doc[str.fieldEmail]
  }
}