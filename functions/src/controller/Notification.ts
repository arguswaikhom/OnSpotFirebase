import admin = require('firebase-admin');
import { Namespace } from '../utils/Namespace';
const firestore = admin.firestore();


export class Notification {
    public static async toOSD(osd, notification) {
        const tokens = osd.get(Namespace.FIELD_DEVICE_TOKEN_OSD) == null || undefined ? null : osd.get(Namespace.FIELD_DEVICE_TOKEN_OSD) as string[]
        if (tokens == null) return

        const payload = { notification: notification };
        const response = await admin.messaging().sendToDevice(tokens, payload);
        const tokensToRemove: any[] = [];

        response.results.forEach((result, index) => {
            const error = result.error;
            if (error) {
                console.error('Failure sending notification to', tokens[index], error);
                if (error.code === 'messaging/invalid-registration-token' || error.code === 'messaging/registration-token-not-registered') {

                    tokensToRemove.push(firestore.collection(Namespace.REF_USER).doc(osd.get(Namespace.FIELD_USER_ID)).update({
                        deviceTokenOSD: admin.firestore.FieldValue.arrayRemove(tokens[index])
                    }));
                }
            }
        });

        return Promise.all(tokensToRemove);
    }

    public static async toOS(os, notification) {
        const tokens = os.get(Namespace.FIELD_DEVICE_TOKEN) == null || undefined ? null : os.get(Namespace.FIELD_DEVICE_TOKEN) as string[]
        if (tokens == null) return

        const payload = {
            notification: notification
        };

        const response = await admin.messaging().sendToDevice(tokens, payload);

        const tokensToRemove: any[] = [];
        response.results.forEach((result, index) => {
            const error = result.error;
            if (error) {
                console.error('Failure sending notification to', tokens[index], error);
                if (error.code === 'messaging/invalid-registration-token' || error.code === 'messaging/registration-token-not-registered') {

                    tokensToRemove.push(firestore.collection(Namespace.REF_USER).doc(os.get(Namespace.FIELD_USER_ID)).update({
                        deviceToken: admin.firestore.FieldValue.arrayRemove(tokens[index])
                    }));
                }
            }
        });

        return Promise.all(tokensToRemove);
    }

    public static async toOSB(osb, notification) {
        const tokens = osb.get(Namespace.FIELD_DEVICE_TOKEN) == null || undefined ? null : osb.get(Namespace.FIELD_DEVICE_TOKEN) as string[]
        if (tokens == null) return

        const payload = {
            notification: notification
        };

        const response = await admin.messaging().sendToDevice(tokens, payload);

        const tokensToRemove: any[] = [];
        response.results.forEach((result, index) => {
            const error = result.error;
            if (error) {
                console.error('Failure sending notification to', tokens[index], error);
                if (error.code === 'messaging/invalid-registration-token' || error.code === 'messaging/registration-token-not-registered') {

                    tokensToRemove.push(firestore.collection(Namespace.REF_BUSINESS).doc(osb.get(Namespace.FIELD_BUSINESS_REF_ID)).update({
                        deviceToken: admin.firestore.FieldValue.arrayRemove(tokens[index])
                    }));
                }
            }
        });

        return Promise.all(tokensToRemove);
    }
}