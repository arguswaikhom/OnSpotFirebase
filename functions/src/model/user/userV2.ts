import { UserV1 } from "./userV1";
import { OSLocation } from '../osLocation';
import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';
import { fieldLocation } from "../../resources/string";

export class UserV2 extends UserV1 {
  location: OSLocation

  constructor(doc: DocumentSnapshot) {
    super(doc)
    this.location = doc[fieldLocation]
  }
}