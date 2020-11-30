import * as functions from 'firebase-functions';
import admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

import { User } from './model/User';
import { DistanceUtil } from './model/DistanceUtil'
import { TimeUtil } from './model/TimeUtil'
import { Business } from './model/Business';
import { ListData } from './model/MockData';
import { Namespace } from './utils/Namespace';
import { NotificationSender } from './controller/notificationController';

// const storage = new Storage({keyFilename: "../onspot-gcloud-key.json"});
const firestore = admin.firestore();
const timestamp = admin.firestore.Timestamp

const DOC_DELIVERY_RANGE = 'deliveryRange'
const DOC_LAUNCH_REGION = 'launchRegion'
const DOC_BUSINESS_TYPE = 'business-type'

const REF_USER: string = 'user'
const REF_BUSINESS: string = 'business'
const REF_CROWN_ONSPOT: string = 'crown-onspot'

exports.order = require('./functions/order')
exports.product = require('./functions/product')
exports.review = require('./functions/review')
exports.explore = require('./functions/explore')
exports.business = require('./functions/business')
exports.business_partner = require('./functions/business-partner')

export const onCreateUser = functions.auth.user().onCreate(async (user) => {
    if (user.email === null) {
        await admin.auth().deleteUser(user.uid).then(function () {
            return
        });
    } else {
        try {
            await firestore.collection(REF_USER).doc(user.uid).set({
                displayName: user.displayName,
                email: user.email,
                phoneNumber: user.phoneNumber,
                profileImageUrl: user.photoURL,
                userId: user.uid,
                hasEmailVerified: user.emailVerified,
                hasPhoneNumberVerified: false,
                hasOnSpotAccount: false,
                hasOnSpotBusinessAccount: false,
                hasOnSpotDeliveryAccount: false,
            })
        } catch (error) {
            console.error(error)
        }
    }
});


export const getUser = functions.https.onRequest(async (request, response) => {
    const userId: string = request.body.userId

    await firestore.collection(REF_USER).doc(userId).get()
        .then(doc => {
            if (doc.exists) {
                const user: User = User.fromDoc(doc)
                console.log("get user : " + user.email)
                response.status(200).send(JSON.stringify(user))
            }
            console.log("user not found : " + userId)
            response.status(404).send('404 - user not found!!')
        }).catch(error => {
            console.log(error)
            response.status(400).send(error)
        });
});


/**
 * Create a new business.
 */
export const createBusiness = functions.https.onRequest(async (request, response) => {
    const data = JSON.parse(request.body.data)

    try {
        /**
         * Check if the "businessId" is already taken 
         */
        const duplicateBId = await firestore.collection(REF_BUSINESS).where('businessId', '==', data.businessId).get()
        if (duplicateBId !== null && duplicateBId.size > 0) {
            /**
            * "businessID" is already taken by some other business
            */
            return response.send({
                'status': 401,
                'error': 'Business ID is not available.'
            })
        }

        /**
         * Check if the selected business location is launch region or not
         */

        const launchRegion = await firestore.collection(REF_CROWN_ONSPOT).doc(DOC_LAUNCH_REGION).get()
        if (launchRegion.exists) {
            const postalCodes = launchRegion.get('postalCode')
            const found = postalCodes.find(code => code == data.location.postalCode)

            if (found == undefined) {
                return response.status(200).send({
                    'status': 204,
                    'isAvailable': false
                })
            }
        }

        const deliveryRange = (await firestore.collection(REF_CROWN_ONSPOT).doc(DOC_DELIVERY_RANGE).get()).get('value')
        if (deliveryRange < data.deliveryRange) {
            console.log('New delivery range ', data.deliveryRange)
            await firestore.collection(REF_CROWN_ONSPOT).doc(DOC_DELIVERY_RANGE).update({
                'value': data.deliveryRange
            })
        }

        const newBusiness = await firestore.collection(REF_BUSINESS).add({
            displayName: data.displayName,
            businessId: data.businessId,
            businessType: data.businessType,
            mobileNumber: data.mobileNumber,
            email: data.email,
            website: data.website,
            creator: data.creator,
            createdOn: timestamp.fromDate(new Date()),
            holder: [{
                userId: data.creator,
                role: 'owner'
            }],
            location: {
                addressLine: data.location.addressLine,
                geoPoint: new admin.firestore.GeoPoint(data.location.geoPoint.latitude, data.location.geoPoint.longitude),
                postalCode: data.location.postalCode,
                howToReach: data.location.howToReach
            },
            openingTime: {
                hour: data.openingTime.hour,
                minute: data.openingTime.minute,
                zone: data.openingTime.zone
            },
            closingTime: {
                hour: data.closingTime.hour,
                minute: data.closingTime.minute,
                zone: data.closingTime.zone
            },
            openingDays: data.openingDays,
            deliveryRange: data.deliveryRange,
            passiveOpenEnable: data.passiveOpenEnable
        })

        await firestore.collection(REF_BUSINESS).doc(newBusiness.id).update({
            businessRefId: newBusiness.id
        })

        await firestore.collection(REF_USER).doc(data.creator).update({
            hasOnSpotBusinessAccount: true,
            businessId: data.businessId,
            businessRefId: newBusiness.id
        })

        return response.status(200).send({
            'status': 200,
            'businessId': data.businessId,
            'businessRefId': newBusiness.id
        })
    } catch (error) {
        console.error('error: ' + error)
        return response.status(400)
    }
});


/**
 * Update an existing business.
 */
export const updateBusiness = functions.https.onRequest(async (request, response) => {
    const data = JSON.parse(request.body.data)
    const oldBusinessId = request.body.oldBusinessId
    const oldDeliveryRange = request.body.oldDeliveryRange

    try {

        const promises: any[] = []

        /** BusinessId has changed */
        if (oldBusinessId != data.businessId) {

            /** Check if the "businessId" is already taken */
            const duplicateBId = await firestore.collection(REF_BUSINESS).where('businessId', '==', data.businessId).get()
            let hasDuplicateBId = false
            if (duplicateBId !== null && duplicateBId.size > 0) {
                duplicateBId.forEach(bDoc => {
                    if (bDoc.get('businessRefId') !== data.businessRefId) {
                        /**
                        * "businessID" is already taken by some other business
                        */
                        hasDuplicateBId = true
                    }
                })
            }

            if (hasDuplicateBId) {
                return response.status(200).send({
                    'status': 401,
                    'error': 'Business ID is not available.'
                })
            }

            /** Update the "businessId" to all the holders of the business */
            for (const holder of data.holder) {
                promises.push(firestore.collection(REF_USER).doc(holder.userId).update({
                    businessId: data.businessId,
                }))
            }
        }

        /**
         * Check if the selected business location is launch region or not
         */

        const launchRegion = await firestore.collection(REF_CROWN_ONSPOT).doc(DOC_LAUNCH_REGION).get()
        if (launchRegion.exists) {
            const postalCodes = launchRegion.get('postalCode')
            const found = postalCodes.find(code => code == data.location.postalCode)

            if (found == undefined) {
                return response.status(200).send({
                    'status': 204,
                    'isAvailable': false
                })
            }
        }

        if (oldDeliveryRange < data.deliveryRange) {
            const deliveryRange = (await firestore.collection(REF_CROWN_ONSPOT).doc(DOC_DELIVERY_RANGE).get()).get('value')
            if (deliveryRange < data.deliveryRange) {
                console.log('New delivery range ', data.deliveryRange)
                promises.push(firestore.collection(REF_CROWN_ONSPOT).doc(DOC_DELIVERY_RANGE).update({
                    'value': data.deliveryRange
                }))
            }
        }


        /**
         * Update the business details
         */
        promises.push(firestore.collection(REF_BUSINESS).doc(data.businessRefId).update({
            displayName: data.displayName,
            businessId: data.businessId,
            businessType: data.businessType,
            mobileNumber: data.mobileNumber,
            email: data.email,
            website: data.website,
            location: {
                addressLine: data.location.addressLine,
                geoPoint: new admin.firestore.GeoPoint(data.location.geoPoint.latitude, data.location.geoPoint.longitude),
                postalCode: data.location.postalCode,
                howToReach: data.location.howToReach == undefined ? '' : data.location.howToReach
            },
            openingTime: {
                hour: data.openingTime.hour,
                minute: data.openingTime.minute,
                zone: data.openingTime.zone
            },
            closingTime: {
                hour: data.closingTime.hour,
                minute: data.closingTime.minute,
                zone: data.closingTime.zone
            },
            openingDays: data.openingDays,
            deliveryRange: data.deliveryRange,
            passiveOpenEnable: data.passiveOpenEnable
        }))

        await Promise.all(promises)

        return response.status(200).send({
            'status': 200,
            'businessId': data.businessId,
            'businessRefId': data.businessRefId
        })
    } catch (error) {
        console.error('error: ' + error)
        return response.status(400)
    }
});


/**
 * Get all the business relavent to the user's current location
 */
export const getUserAllBusiness = functions.https.onRequest(async (request, response) => {
    const centerGP = JSON.parse(request.body.data) as admin.firestore.GeoPoint
    const result: any[] = []

    console.log('User location: ', JSON.stringify(centerGP))

    try {

        /** get common delivery range from the database */
        const radius = (await firestore.collection(REF_CROWN_ONSPOT).doc(DOC_DELIVERY_RANGE).get()).get('value')
        console.log('Delivery range: ', radius)

        /** find all the business which are in the common delivery range from the user's location */
        const box = DistanceUtil.boundingBoxCoordinates(centerGP, radius);
        const lesserGP = new admin.firestore.GeoPoint(box.swCorner.latitude, box.swCorner.longitude);
        const greaterGP = new admin.firestore.GeoPoint(box.neCorner.latitude, box.neCorner.longitude);

        const fieldPath = new admin.firestore.FieldPath('location', 'geoPoint')
        const query = await firestore.collection(REF_BUSINESS).where(fieldPath, '>', lesserGP).where(fieldPath, '<', greaterGP).get()
        console.log('Business in radius: ', query.size)

        /** remove all the business which are not available for an online order */
        query.forEach(business => {

            /** If the business is close don't include */
            const isOpen: boolean = business.get('open') == null ? true : business.get('open')
            if (isOpen) {

                /** Find the distance between user and business location */
                const businessGP = business.get('location').geoPoint
                const distance = DistanceUtil.distance(businessGP, centerGP)

                /** If the distance is more than business's delivery range, do not include */
                const deliveryRange = business.get('deliveryRange') == null ? null : business.get('deliveryRange')
                if (deliveryRange == null || distance <= deliveryRange) {

                    /** Check if the business is passively open */
                    const isPassivelyOpen = business.get('passiveOpenEnable') == null ? null : business.get('passiveOpenEnable')
                    if (isPassivelyOpen == null || isPassivelyOpen) {
                        result.push(Business.fromDoc(business))
                    } else {

                        /** If the business is not passively open, check if the current time is in the opening time range of the business
                         * If the current time is not in the opening time range of the business, don't include
                         */
                        let timeNow = new Date()
                        console.log('day: ', timeNow.getDay())
                        timeNow = TimeUtil.getTime({ hour: timeNow.getHours(), min: timeNow.getMinutes, zone: '' })
                        const openingTime = TimeUtil.getTime(business.get('openingTime'))
                        const closingTime = TimeUtil.getTime(business.get('closingTime'))

                        if (timeNow >= openingTime && timeNow < closingTime) {
                            result.push(Business.fromDoc(business))
                        }
                    }
                }
            }
        })

        console.log('Business in return: ', result.length)
        console.log('Response: ', JSON.stringify(result))

        if (result.length == 0) {
            return response.status(200).send({
                'status': 204,
                'data': result
            })
        }

        return response.status(200).send({
            'status': 200,
            'data': result
        })
    } catch (error) {
        console.error('error: ' + error)
        return response.status(400)
    }
});


/**
 * Check if the user's current location is one of the launch region
 */
export const getBusinessAvailability = functions.https.onRequest(async (request, response) => {
    const postalCode = request.body.postalCode

    console.log('Postal code: ', postalCode)

    try {
        const launchRegion = await firestore.collection(REF_CROWN_ONSPOT).doc(DOC_LAUNCH_REGION).get()
        if (launchRegion.exists) {
            const postalCodes = launchRegion.get('postalCode')
            const found = postalCodes.find(code => code == postalCode)

            if (found == undefined) {
                return response.status(200).send({
                    'status': 204,
                    'isAvailable': false
                })
            } else {
                return response.status(200).send({
                    'status': 200,
                    'isAvailable': true
                })
            }
        } else {
            return response.status(400)
        }
    } catch (error) {
        console.error('error: ' + error)
        return response.status(400)
    }
});


/**
 * Check if the given email is already registered or not 
 */
export const getAccountAvailability = functions.https.onRequest(async (request, response) => {
    const email = request.body.email

    console.log("Email: ", email)

    try {
        const user = await admin.auth().getUserByEmail(email)
        console.log("User: ", user)
        return response.status(200).send({
            'status': 200,
            'email': email,
            'isAvailable': true
        })
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            return response.status(200).send({
                'status': 204,
                'email': email,
                'isAvailable': false
            })
        } else {
            console.error('error: ', error)
            return response.status(400)
        }
    }
});


export const updateLaunchRegion = functions.https.onRequest(async (request, response) => {
    const postalCodes = ListData.getLaunchRegions()

    try {
        const res = await firestore.collection(REF_CROWN_ONSPOT).doc(DOC_LAUNCH_REGION).set({
            postalCode: postalCodes
        })
        return response.send(res)
    } catch (error) {
        console.error('error: ', error)
        return response.status(400)
    }
});

export const updateBusinessType = functions.https.onRequest(async (request, response) => {
    const businessType = ListData.getBusinessType()

    try {
        const res = await firestore.collection(REF_CROWN_ONSPOT).doc(DOC_BUSINESS_TYPE).set({
            'business-type': businessType
        })
        return response.send(res)
    } catch (error) {
        console.error('error: ', error)
        return response.status(400)
    }
});


/* export const acceptDPRequest = functions.https.onRequest(async (request, response) => {
    try {
        const status = 'ACCEPTED'
        const userId = request.body.userId
        const businessRefId = request.body.businessRefId
        const notificationId = request.body.notificationId

        const promisses: any[] = []

        // Get the business list of the user and update the list
        const updatedOSBs: any[] = []
        const user = await firestore.collection(Namespace.REF_USER).doc(userId).get()
        const OSDBusiness = user.get('businessOSD')
        if (OSDBusiness != null && OSDBusiness != undefined && OSDBusiness.length > 0) {
            OSDBusiness.forEach(obj => {
                if (obj['businessRefId'] == businessRefId) updatedOSBs.push({ 'businessRefId': businessRefId, 'status': status })
                else updatedOSBs.push(obj)
            })
        }

        // Get the delivery partner list and update the list
        const updatedDPs: any[] = []
        const business = await firestore.collection(Namespace.REF_BUSINESS).doc(businessRefId).get()
        const DPs = business.get('osd')
        if (DPs != null && DPs != undefined && DPs.length > 0) {
            DPs.forEach(obj => {
                if (obj['userId'] == userId) updatedDPs.push({ 'userId': userId, 'status': status })
                else updatedDPs.push(obj)
            })
        } else {
            updatedDPs.push({ 'userId': userId, 'status': status })
        }

        // Update OSD user's business partners
        promisses.push(firestore.collection(Namespace.REF_USER).doc(userId).update({ 'businessOSD': updatedOSBs }))

        // Update the delivery partners of the business
        promisses.push(firestore.collection(Namespace.REF_BUSINESS).doc(businessRefId).update({ 'osd': updatedDPs }))

        // Update notification
        promisses.push(firestore.collection(Namespace.REF_NOTIFICATION).doc(notificationId).update({ 'status': status }))

        // Send notification to osd
        try {
            const notification = { title: 'Request Accepted', body: business.get(Namespace.FIELD_DISPLAY_NAME) + ' accepted your delivery partnership request', }
            await NotificationSender.toOSD(user, notification)
        } catch (error) {
            console.error(error)
        }

        await Promise.all(promisses)
        return response.status(200).send('Accepted')
    } catch (error) {
        console.error(error)
        return response.status(400).send('Something went wrong!!')
    }
})


export const rejectDPRequest = functions.https.onRequest(async (request, response) => {
    try {
        const status = 'REJECTED'
        const userId = request.body.userId
        const businessDisplayName = request.body.displayName
        const businessRefId = request.body.businessRefId
        const notificationId = request.body.notificationId

        const promisses: any[] = []

        // Get the business list of the user and update the list
        const updatedOSBs: any[] = []
        const user = await firestore.collection(Namespace.REF_USER).doc(userId).get()
        const OSDBusiness = user.get('businessOSD')
        if (OSDBusiness != null && OSDBusiness != undefined && OSDBusiness.length > 0) {
            OSDBusiness.forEach(obj => { if (obj['businessRefId'] != businessRefId) updatedOSBs.push(obj) })
        }

        // Update OSD user's business partners
        promisses.push(firestore.collection(Namespace.REF_USER).doc(userId).update({ 'businessOSD': updatedOSBs }))

        // Update notification
        promisses.push(firestore.collection(Namespace.REF_NOTIFICATION).doc(notificationId).update({ 'status': status }))

        // Send notification to osd
        try {
            const notification = { title: 'Request Rejected', body: businessDisplayName + ' rejected your delivery partnership request', }
            await NotificationSender.toOSD(user, notification)
        } catch (error) {
            console.error(error)
        }

        await Promise.all(promisses)
        return response.status(200).send('Rejected')
    } catch (error) {
        console.error(error)
        return response.status(400).send('Something went wrong!!')
    }
}) */