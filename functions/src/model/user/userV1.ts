import { UserV0 } from "./userV0";
import { DocumentSnapshot } from "firebase-functions/lib/providers/firestore";
import * as str from "../../resources/string"


export class UserV1 extends UserV0 {
  email: string
  phoneNumber: string

  constructor(doc: DocumentSnapshot) {
    super(doc)
    this.email = doc[str.fieldEmail]
    this.phoneNumber = doc[str.fieldPhoneNumber]
  }
}