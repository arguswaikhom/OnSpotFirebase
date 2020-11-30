import admin = require('firebase-admin');
import * as functions from 'firebase-functions';
import * as str from '../resources/string';
import * as ct from '../utils/list-item-type'
import { BusinessRequestStatus } from '../utils/enum';
import { ListUtils } from '../utils/listutils';
import { NotificationSender } from '../controller/notificationController';
import { Utils } from '../utils/utils';

const firestore = admin.firestore();

/**
 * Cancel partnership between business and delivery
 * 
 * 1 -> If the osd user is currently in an order, remove the osd user from those orders
 * 2 -> Remove the osd user from business's delivery partnership
 * 3 -> Remove the business from osd user's business partnership
 * 4 -> Added an new cancellation activity notification doc for the opposite entity
 * 5 -> Check who initiated the cancelation request
 *   -> If initiated by business -> send notification to osd user
 *   -> If initiated by osd user -> send notification to business
 */
exports.cancelBusinessPartnership = functions.https.onRequest(async (request, response) => {
  try {
    const deliveryUserId = request.body.userId
    const businessRefId = request.body.businessRefId
    const initiator = request.body.initiator


    await firestore.runTransaction(async t => {
      const user = await t.get(firestore.collection(str.refUser).doc(deliveryUserId))
      const business = await t.get(firestore.collection(str.refBusiness).doc(businessRefId))

      const deliveryPartners: any[] = business.get(str.fieldOsd)
      const businessPartners: any[] = user.get(str.fieldBusinessOSD)

      // * 1 -> Check if user has any current active order from this business; if it has, remove delivery from those orders
      const activeOrderByUser = await t.get(firestore.collection(str.refOrder)
        .where(new admin.firestore.FieldPath(str.fieldDelivery, str.fieldUserId), '==', deliveryUserId)
        .where(str.fieldIsActiveOrder, '==', true)
        .where(new admin.firestore.FieldPath(str.fieldBusiness, str.fieldBusinessRefId), '==', businessRefId))
      if (!Utils.isEmpty(activeOrderByUser) && !activeOrderByUser.empty) {
        activeOrderByUser.forEach(order => {
          const toUpdateDelivery = {}
          toUpdateDelivery[str.fieldDelivery] = null
          t.update(firestore.collection(str.refOrder).doc(order.id), toUpdateDelivery)
        })
      }
      // * -> 1


      // * 2 -> Remove the business partner from the business partner list of the osd user
      if (!ListUtils.isEmpty(businessPartners)) {
        const updatedBusinessPartners: any[] = []
        businessPartners.forEach(p => { if (p[str.fieldBusinessRefId] != business.id) updatedBusinessPartners.push(p) })
        const toUpdate = {}
        toUpdate[str.fieldBusinessOSD] = updatedBusinessPartners
        t.update(firestore.collection(str.refUser).doc(user.id), toUpdate)
      }
      // * -> 2


      // * 3 -> Remove the delivery partner from the osd list of the business
      if (!ListUtils.isEmpty(deliveryPartners)) {
        const updatedDeliveryPartners: any[] = []
        deliveryPartners.forEach(p => { if (p[str.fieldUserId] != user.id) updatedDeliveryPartners.push(p) })
        const toUpdate = {}
        toUpdate[str.fieldOsd] = updatedDeliveryPartners
        t.update(firestore.collection(str.refBusiness).doc(business.id), toUpdate)
      }
      // * -> 3


      // * 4 -> Create a activity notification doc for the cancelation
      const noti = {}
      const notiDoc = firestore.collection(str.refNotification).doc()
      noti[str.fieldId] = notiDoc.id
      noti[str.fieldAccount] = [str.prefixBusiness + business.get(str.fieldBusinessRefId), str.prefixDelivery + user.get(str.fieldUserId)]
      noti[str.fieldOsb] = business.get(str.fieldBusinessRefId)
      noti[str.fieldOsd] = user.get(str.fieldUserId)
      noti[str.fieldStatus] = BusinessRequestStatus.CANCELED
      noti[str.fieldType] = ct.DELIVERY_PARTNERSHIP_REQUEST
      noti[str.fieldCreatedAt] = admin.firestore.FieldValue.serverTimestamp()
      t.create(notiDoc, noti)
      // * -> 4


      // * 5 -> Based on the inititator, send notification
      try {
        if (initiator == str.initiatorBusiness) {
          const notification = { title: 'Partnership cancelled', body: business.get(str.fieldDisplayName) + ' cancelled your delivery partnership', }
          await NotificationSender.toOSD(user, notification)
        } else if (initiator == str.initiatorDelivery) {
          const notification = { title: 'Partnership cancelled', body: user.get(str.fieldDisplayName) + ' cancelled your delivery partnership', }
          await NotificationSender.toOSB(business, notification)
        }
      } catch (_) { }
      // * -> 5
    })
    return response.status(200).send()
  } catch (error) {
    console.error(error)
    return response.status(400).send()
  }
})


/**
 * * Perform in a transaction
 * 1 -> Check whether the user and the business already has connection
 *      If yes - return, else continue
 * 2 -> If the osd user already has 10 businesses in the partnership request, don't add a new one (max business parter of an osd user is 10)
 * 3 -> Add business request to the business doc
 * 4 -> Add request to the osd user's business partners
 * 5 -> Add a new doc to the notification collection
 * 6 -> Send notification to the business
 */
exports.addBusinessRequest = functions.https.onRequest(async (request, response) => {
  try {
    const business = JSON.parse(request.body.osb)
    const user = JSON.parse(request.body.osd)
    const type = ct.DELIVERY_PARTNERSHIP_REQUEST
    const status = BusinessRequestStatus.PENDING

    await firestore.runTransaction(async t => {
      // * 1 -> If the OSD user and the business already have relationship, don't add a new request
      const userOSD = await t.get(firestore.collection(str.refUser).doc(user[str.fieldUserId]))
      const OSDBusiness = userOSD.get(str.fieldBusinessOSD)
      if (!ListUtils.isEmpty(OSDBusiness)) {
        let conflict = false
        OSDBusiness.forEach(obj => { if (obj[str.fieldBusinessRefId] == business[str.fieldBusinessRefId]) conflict = true })
        if (conflict) return response.status(200).send({
          status: 200,
          message: 'Already available'
        })
      }
      // * -> 1


      // * 2 -> An osd user can have max 10 business partners
      // If the user aready has 10, don't ad a new one
      if (!ListUtils.isEmpty(OSDBusiness) && OSDBusiness.length >= 10) {
        return response.status(200).send({
          status: 406,
          message: 'Already has 10 business in the partners in the partnership list'
        })
      }
      // * -> 2

      // * 3 -> Add to the delivery partners of the business
      const osd = {}
      osd[str.fieldUserId] = user[str.fieldUserId]
      osd[str.fieldStatus] = status
      t.update(firestore.collection(str.refBusiness).doc(business[str.fieldBusinessRefId]), { 'osd': admin.firestore.FieldValue.arrayUnion(osd) })
      // * -> 3


      // * 4 -> Add business partner to the OSD user
      const businessOSD = {}
      businessOSD[str.fieldBusinessRefId] = business[str.fieldBusinessRefId]
      businessOSD[str.fieldStatus] = status
      t.update(firestore.collection(str.refUser).doc(user[str.fieldUserId]), { 'businessOSD': admin.firestore.FieldValue.arrayUnion(businessOSD) })
      // * -> 4


      // * 5 -> Add a new notification to the notification collection
      const noti = {}
      noti[str.fieldAccount] = [str.prefixBusiness + business[str.fieldBusinessRefId], str.prefixDelivery + user[str.fieldUserId]]
      noti[str.fieldOsb] = business[str.fieldBusinessRefId]
      noti[str.fieldOsd] = user[str.fieldUserId]
      noti[str.fieldStatus] = status
      noti[str.fieldType] = type
      noti[str.fieldCreatedAt] = admin.firestore.FieldValue.serverTimestamp()
      t.create(firestore.collection(str.refNotification).doc(), noti)
      // * -> 5


      // * 6 -> Send notification to the business
      try {
        const notification = { title: 'Delivery Partnership Request', body: user[str.fieldDisplayName] + ' wants to be your delivery partner', }
        const osb = await firestore.collection(str.refBusiness).doc(business[str.fieldBusinessRefId]).get()
        await NotificationSender.toOSB(osb, notification)
      } catch (_) {
        // Ignore error for the notification
      }
      // * -> 6

      return response.status(200).send({ status: 200, message: 'Request sent' })
    })

    return
  } catch (error) {
    console.error(error)
    return response.status(400).send(400)
  }
})


/**
 * API to accept a delivery partnership request
 * 
 * 1 -> Update delivery partnership list to the business doc
 * 2 -> Update business partnership list to the osd user doc
 * 3 -> Update notification doc
 * 4 -> Send notofication to the osd user 
 */
exports.acceptDPRequest = functions.https.onRequest(async (request, response) => {
  try {
    const acceptedStatus = BusinessRequestStatus.ACCEPTED
    const userId = request.body.userId
    const businessRefId = request.body.businessRefId
    let notificationId = request.body.notificationId

    await firestore.runTransaction(async t => {
      const user = await t.get(firestore.collection(str.refUser).doc(userId))
      const business = await t.get(firestore.collection(str.refBusiness).doc(businessRefId))
      // If notification id is not present, find it and update
      if (Utils.isEmpty(notificationId)) {
        const q = await t.get(firestore.collection(str.refNotification).where(str.fieldType, '==', ct.DELIVERY_PARTNERSHIP_REQUEST).where(str.fieldOsb, '==', businessRefId).where(str.fieldOsd, '==', userId))
        if (!q.empty) notificationId = q.docs[0].id
      }

      // * 1 -> Get the business list of the user and update the list
      const businessPartners: any[] = user.get(str.fieldBusinessOSD)
      if (!ListUtils.isEmpty(businessPartners)) {
        const updatedBusinessPartners: any = {}
        businessPartners.forEach(p => { if (p[str.fieldBusinessRefId] == businessRefId) p[str.fieldStatus] = acceptedStatus })
        updatedBusinessPartners[str.fieldBusinessOSD] = businessPartners
        t.update(firestore.collection(str.refUser).doc(userId), updatedBusinessPartners)
      }
      // * -> 1


      // * 2 -> Get the delivery partnership list of the business and update the list
      const deliveryPartners: any[] = business.get(str.fieldOsd)
      if (!ListUtils.isEmpty(deliveryPartners)) {
        const updatedDeliveryPartners = {}
        deliveryPartners.forEach(p => { if (p[str.fieldUserId] == userId) p[str.fieldStatus] = acceptedStatus })
        updatedDeliveryPartners[str.fieldOsd] = deliveryPartners
        t.update(firestore.collection(str.refBusiness).doc(businessRefId), updatedDeliveryPartners)
      }
      // * -> 2


      // * 3 -> Update notification
      if (!Utils.isEmpty(notificationId)) {
        const notiUpdate = {}
        notiUpdate[str.fieldStatus] = acceptedStatus
        t.update(firestore.collection(str.refNotification).doc(notificationId), notiUpdate)
      }
      // * -> 3


      // * 4 -> Send notification to the osd user
      try {
        const notification = { title: 'Request Accepted', body: business.get(str.fieldDisplayName) + ' accepted your delivery partnership request', }
        await NotificationSender.toOSD(user, notification)
      } catch (_) {
        // Ignore error for the notification
      }
      // * -> 4
    })
    return response.status(200).send('Accepted')
  } catch (error) {
    console.error(error)
    return response.status(400).send('Something went wrong!!')
  }
})


/**
 * API to reject delivery partnership request by business or osd user
 * 
 * 1 -> Remove from delivery partnership list to the business doc
 * 2 -> Remove from business partnership list to the osd user doc
 * 3 -> Update notification doc
 *   -> Rejected by business 
 *      -> Update notification doc to rejected
 *      -> Send notofication to the osd user 
 *   -> Rejected by osd 
 *      -> Delete notification doc
 */
exports.rejectDPRequest = functions.https.onRequest(async (request, response) => {
  try {
    const rejectedStatus = BusinessRequestStatus.REJECTED
    const userId = request.body.userId
    const businessRefId = request.body.businessRefId
    const initiator = request.body.initiator
    let notificationId = request.body.notificationId

    await firestore.runTransaction(async t => {
      const user = await t.get(firestore.collection(str.refUser).doc(userId))
      const business = await t.get(firestore.collection(str.refBusiness).doc(businessRefId))
      // If notification id is not present, find it and update
      if (Utils.isEmpty(notificationId)) {
        const q = await t.get(firestore.collection(str.refNotification).where(str.fieldType, '==', ct.DELIVERY_PARTNERSHIP_REQUEST).where(str.fieldOsb, '==', businessRefId).where(str.fieldOsd, '==', userId))
        if (!q.empty) notificationId = q.docs[0].id
      }


      // * 1 -> Remove the business partner from the business partner list of the osd user
      const businessPartners = user.get(str.fieldBusinessOSD)
      if (!ListUtils.isEmpty(businessPartners)) {
        const updatedBusinessPartners: any[] = []
        businessPartners.forEach(p => { if (p[str.fieldBusinessRefId] != businessRefId) updatedBusinessPartners.push(p) })
        const toUpdate = {}
        toUpdate[str.fieldBusinessOSD] = updatedBusinessPartners
        t.update(firestore.collection(str.refUser).doc(userId), toUpdate)
      }
      // * -> 1


      // * 2 -> Remove the delivery partner from the osd list of the business
      const deliveryPartners = business.get(str.fieldOsd)
      if (!ListUtils.isEmpty(deliveryPartners)) {
        const updatedDeliveryPartners: any[] = []
        deliveryPartners.forEach(p => { if (p[str.fieldUserId] != userId) updatedDeliveryPartners.push(p) })
        const toUpdate = {}
        toUpdate[str.fieldOsd] = updatedDeliveryPartners
        t.update(firestore.collection(str.refBusiness).doc(businessRefId), toUpdate)
      }
      // * -> 2


      // * 3 -> Update the notification doc of the request
      if (!Utils.isEmpty(notificationId)) {
        // If the request was initiated by the business, 
        // update the status to rejected and keep the notification doc, to show it to the osd user's activity notification
        if (initiator == 'osb') {
          const toUpdate = {}
          // No need to display activity notification to the business since the request was rejected by them
          toUpdate[str.fieldAccount] = admin.firestore.FieldValue.arrayRemove('osb::' + businessRefId)
          toUpdate[str.fieldStatus] = rejectedStatus
          t.update(firestore.collection(str.refNotification).doc(notificationId), toUpdate)
        } else if (initiator == 'osd') {
          // Delete the whode notification doc, if it was rejected by the osd user
          t.delete(firestore.collection(str.refNotification).doc(notificationId))
        }
      }

      // If a business rejected the request, notify it to the osd user
      if (initiator == 'osb') {
        try {
          const notification = { title: 'Request Rejected', body: business.get(str.fieldDisplayName) + ' rejected your delivery partnership request', }
          await NotificationSender.toOSD(user, notification)
        } catch (_) { }
      }
      // * -> 3
    })

    return response.status(200).send('Rejected')
  } catch (error) {
    console.error(error)
    return response.status(400).send('Something went wrong!!')
  }
})