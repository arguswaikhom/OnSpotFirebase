import { BusinessV1 } from './businessV1';
import { OSLocation } from '../osLocation';
import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';
import * as str from '../../resources/string'


export class BusinessV2 extends BusinessV1 {
  businessType: string
  businessTypes: string[]
  location: OSLocation
  hodAvailable: boolean

  constructor(doc: DocumentSnapshot) {
    super(doc)
    this.businessType = doc[str.fieldBusinessType]
    this.businessTypes = doc[str.fieldBusinessTypes]
    this.location = doc[str.fieldLocation]
    this.hodAvailable = doc[str.fieldHodAvailable]
  }
}