import { DocumentSnapshot } from "firebase-functions/lib/providers/firestore"
import * as str from "../../resources/string"

export class UserOrder {
  displayName: string
  location: string
  userId: string

  constructor(doc: DocumentSnapshot) {
    this.displayName = doc[str.fieldDisplayName]
    this.location = doc[str.fieldLocation]
    this.userId = doc[str.fieldUserId]
  }
}