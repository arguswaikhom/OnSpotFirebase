import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';

export class User {
    displayName: string
    email: string
    phoneNumber: string
    profileImageUrl: string
    userId: string
    hasEmailVerified: boolean
    hasPhoneNumberVerified: boolean
    hasOnSpotAccount: boolean
    hasOnSpotBusinessAccount: boolean
    hasOnSpotDeliveryAccount: boolean
    businessId: string
    businessRefId: string

    constructor(displayName: string, email: string, emailVerified: boolean, phoneNumber: string, 
        hasPhoneNumberVerified: boolean, profileImageUrl: string, userId: string, hasOnSpotAccount: boolean, 
        hasOnSpotBusinessAccount: boolean, hasOnSpotDeliveryAccount: boolean, businessId: string, businessRefId: string) {
        this.displayName = displayName
        this.email = email
        this.hasEmailVerified = emailVerified
        this.phoneNumber = phoneNumber
        this.hasPhoneNumberVerified = hasPhoneNumberVerified
        this.profileImageUrl = profileImageUrl
        this.userId = userId
        this.hasOnSpotAccount = hasOnSpotAccount
        this.hasOnSpotBusinessAccount = hasOnSpotBusinessAccount
        this.hasOnSpotDeliveryAccount = hasOnSpotDeliveryAccount
        this.businessId = businessId
        this.businessRefId = businessRefId
    }

    public static fromDoc(doc: DocumentSnapshot): User {
        return new User (
            doc.get('displayName'),
            doc.get('email'),
            doc.get('hasEmailVerified'),
            doc.get('phoneNumber'),
            doc.get('hasPhoneNumberVerified'),
            doc.get('profileImageUrl'),
            doc.get('userId'),
            doc.get('hasOnSpotAccount'),
            doc.get('hasOnSpotBusinessAccount'),
            doc.get('hasOnSpotDeliveryAccount'),
            doc.get('businessId'),
            doc.get('businessRefId')
        );
    }
}