import { DocumentSnapshot } from "firebase-functions/lib/providers/firestore"
import * as str from "../../resources/string"

export class UserV0 {
    displayName: string
    profileImageUrl: string
    userId: string

    constructor(doc: DocumentSnapshot) {
        console.log(JSON.stringify(doc))
        this.displayName = doc[str.fieldDisplayName]
        this.profileImageUrl = doc[str.fieldProfileImageUrl]
        this.userId = doc[str.fieldUserId]
    }
}