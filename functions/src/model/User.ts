import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';

export class User {
    displayName: string
    email: string
    emailVerified: boolean
    phoneNumber: string
    phoneNumberVerified: boolean
    profileImageUrl: string
    userId: string
    onSpotAccount: boolean
    onSpotBusinessAccount: boolean
    onSpotDeliveryAccount: boolean

    constructor(displayName: string, email: string, emailVerified: boolean, phoneNumber: string, phoneNumberVerified: boolean, profileImageUrl: string, userId: string, onSpotAccount: boolean, onSpotBusinessAccount: boolean, onSpotDeliveryAccount: boolean, ) {
        this.displayName = displayName
        this.email = email
        this.emailVerified = emailVerified
        this.phoneNumber = phoneNumber
        this.phoneNumberVerified = phoneNumberVerified
        this.profileImageUrl = profileImageUrl
        this.userId = userId
        this.onSpotAccount = onSpotAccount
        this.onSpotBusinessAccount = onSpotBusinessAccount
        this.onSpotDeliveryAccount = onSpotDeliveryAccount
    }

    public static fromDoc(doc: DocumentSnapshot): User {
        return new User (
            doc.get('displayName'),
            doc.get('email'),
            doc.get('emailVerified'),
            doc.get('phoneNumber'),
            doc.get('phoneNumberVerified'),
            doc.get('profileImageUrl'),
            doc.get('userId'),
            doc.get('onSpotAccount'),
            doc.get('onSpotBusinessAccount'),
            doc.get('onSpotDeliveryAccount')
        );
    }
}