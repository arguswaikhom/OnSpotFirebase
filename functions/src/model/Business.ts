import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';


export class Business {
    public static fromDoc(doc: DocumentSnapshot) {
        const locObj = doc.get('location')
        console.log(JSON.stringify(locObj['geoPoint']))
        console.log(locObj['geoPoint'].latitude, ' : ', locObj['geoPoint'].longitude)
        return {
            businessId: doc.get('businessId'),
            businessRefId: doc.get('businessRefId'),
            businessType: doc.get('businessType'),
            closingTime: doc.get('closingTime'),
            openingTime: doc.get('openingTime'),
            deliveryRange: doc.get('deliveryRange'),
            displayName: doc.get('displayName'),
            email: doc.get('email'),
            imageUrls: doc.get('imageUrls'),
            location: {
                addressLine: locObj['addressLine'],
                geoPoint: {
                    latitude: locObj['geoPoint'].latitude as number,
                    longitude: locObj['geoPoint'].longitude as number
                },
                postalCode: locObj['postalCode']
            },
            mobileNumber: doc.get('mobileNumber'),
            open: doc.get('open') == null ? true : doc.get('open'),
            openingDays: doc.get('openingDays'),
            passiveOpenEnable: doc.get('passiveOpenEnable'),
            website: doc.get('website')
        }
    }
}