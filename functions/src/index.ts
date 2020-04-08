import * as functions from 'firebase-functions';
import admin = require('firebase-admin');
import { User } from './model/User';

admin.initializeApp(functions.config().firebase);

const db = admin.firestore();

const REF_USER: string = 'user'

export const helloWorld = functions.https.onRequest((request, response) => {
    response.send("Hello from Firebase!");
});


export const onCreateUser = functions.auth.user().onCreate(async (user) => {
    await db.collection(REF_USER).doc(user.uid).set({
        displayName: user.displayName,
        email: user.email,
        emailVerified: user.emailVerified,
        phoneNumber: user.phoneNumber,
        phoneNumberVerified: false,
        profileImageUrl: user.photoURL,
        userId: user.uid,
        onSpotAccount: false,
        onSpotBusinessAccount: false,
        onSpotDeleveryAccount: false,
    }).then(ref => {
        console.log("user added: " + user.email)
        return
    }).catch(error => {
        console.log(error)
        return
    })
});


export const getUser = functions.https.onRequest(async (request, response) => {
    const userId: string = request.body.userId

    await db.collection(REF_USER).doc(userId).get()
        .then(doc => {
            if (doc.exists) {
                const user: User = User.fromDoc(doc)
                console.log("get user : " + user.email)
                return response.status(200).send(JSON.stringify(user))
            }
            console.log("user not found : " + userId)
            return response.status(404).send('404 - user not found!!')
        }).catch(error => {
            console.log(error)
            return response.status(400).send(error)
        });
});