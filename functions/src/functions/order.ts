import admin = require('firebase-admin');
import * as functions from 'firebase-functions';
import * as str from '../resources/string';
import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';
import { UserV3 } from '../model/user/userV3';
import { BusinessV2a } from '../model/business/businessV2a';
import { BusinessItemV4 } from '../model/businessItem/businessItemV4';
import { OrderStatus, BusinessRequestStatus } from '../utils/enum';
import { NotificationSender } from '../controller/notificationController';
import { ListUtils } from '../utils/listutils';
import { Utils } from '../utils/utils';
import firebase = require('firebase');

const firestore = admin.firestore();

/**
 * Accepting order delivery by the delivery user
 * 
 * * 1 -> Check whether the user and the business are still partners
 * If they are still partners; add the user as delivery of the order.
 * Otherwise access denied
 */
exports.acceptOrderDeliver = functions.https.onRequest(async (request, response) => {
    try {
        const userId = request.body.userId
        const orderId = request.body.orderId

        return await firestore.runTransaction(async t => {
            const user = await t.get(firestore.collection(str.refUser).doc(userId))
            const order = await t.get(firestore.collection(str.refOrder).doc(orderId))
            const bussId = order.get(str.fieldBusiness)[str.fieldBusinessRefId]
            const business = await t.get(firestore.collection(str.refBusiness).doc(bussId))

            // * 1 -> Check whether the business and OSD user are still delivery partners
            let isStillPartners = false
            const osd = business.get(str.fieldOsd)
            if (!ListUtils.isEmpty(osd)) {
                for (const dp of osd) {
                    if (dp[str.fieldUserId] == userId && dp[str.fieldStatus] == BusinessRequestStatus.ACCEPTED) {
                        // Business and OSD user are still delivery partners
                        isStillPartners = true

                        // Assign the user as the deliver partner of the order
                        const orderDelivery = {}
                        orderDelivery[str.fieldDelivery] = {
                            displayName: user.get(str.fieldDisplayName),
                            userId: userId,
                            location: user.get(str.fieldLocation)
                        }
                        t.update(firestore.collection(str.refOrder).doc(orderId), orderDelivery)
                        return response.status(200).send({
                            status: 200,
                            message: 'Updated successfully'
                        })
                    }
                }
            }

            if (!isStillPartners) {
                // The user and the business are no longer partners
                return response.send({
                    status: 403,
                    message: 'No longer partners'
                })
            }

            // This will never happen
            return response.status(400).send()
        })
    } catch (error) {
        console.error(error)
        return response.status(400).send()
    }
})


/**
 * Remove delivery from an order by the user itself
 * 
 * * 1 -> Check whether the user is delivery of the order
 * If the user is delivery of the order; allow cancel.
 * Otherwise, access denied
 */
exports.cancelOrderDeliver = functions.https.onRequest(async (request, response) => {
    try {
        const userId = request.body.userId
        const orderId = request.body.orderId

        return await firestore.runTransaction(async t => {
            const order = await t.get(firestore.collection(str.refOrder).doc(orderId))

            if (userId == order.get(str.fieldDelivery)[str.fieldUserId]) {
                // User is the delivery of this order
                t.update(firestore.collection(str.refOrder).doc(orderId), { delivery: null })
                return response.send({
                    status: 200,
                    message: "Removed delivery from the order"
                })
            } else {
                return response.send({
                    status: 403,
                    message: "Access denied!!"
                })
            }
        })
    } catch (error) {
        console.error(error)
        return response.status(400).send()
    }
})


/**
 * Confirm order delivered by delivery user
 * 
 * * 1 -> Check whether the user is delivery of the order
 * If the user is delivery of the order; allow confirmation.
 * Otherwise, access denied
 */
exports.confirmOrderDelivery = functions.https.onRequest(async (request, response) => {
    try {
        const userId = request.body.userId
        const orderId = request.body.orderId

        return await firestore.runTransaction(async t => {
            const order = await t.get(firestore.collection(str.refOrder).doc(orderId))

            const result = {}
            const deliveryStatus = 'DELIVERED'

            if (!Utils.isEmpty(order.get(str.fieldDelivery))) {
                if (userId == order.get(str.fieldDelivery)[str.fieldUserId]) {
                    if (order.get(str.fieldStatus) == deliveryStatus) {
                        // The order has already delivered
                        result[str.fieldStatus] = 200
                        result[str.fieldMessage] = 'Order delivered'
                    } else {
                        // Update thr order status to delivered
                        t.update(firestore.collection(str.refOrder).doc(orderId), {
                            status: deliveryStatus,
                            statusRecord: admin.firestore.FieldValue.arrayUnion({
                                status: deliveryStatus,
                                timestamp: Utils.getTimeNow()
                            })
                        })

                        result[str.fieldStatus] = 200
                        result[str.fieldMessage] = 'Order delivered'
                    }
                } else {
                    // User is not the delivery of the order
                    result[str.fieldStatus] = 403
                    result[str.fieldMessage] = 'Access denied!!'
                }
            } else {
                // There is no delivery of this order
                // Since the request is initiated only by the delivery user; delivery user should be in the order
                result[str.fieldStatus] = 403
                result[str.fieldMessage] = 'Access denied!!'
            }

            return response.send(result)
        })
    } catch (error) {
        console.error(error)
        return response.status(400).send()
    }
})


exports.getDetails = functions.https.onRequest(async (request, response) => {
    try {
        const promises: any[] = []
        const orderId = request.body.orderId
        let finalResponse = {}

        // Get order details
        const order = await firestore.collection(str.refOrder).doc(orderId).get()

        // Get details of all the items in the order
        const itemIds: any[] = []
        const itemResponse: BusinessItemV4[] = []
        const orderItems = order.get(str.fieldItems)
        const customerId = order.get(str.fieldCustomer)[str.fieldUserId]
        const businessRefId = order.get(str.refBusiness)[str.fieldBusinessRefId]
        for (let i = 0; i < orderItems.length; i++) itemIds.push(orderItems[i][str.fieldItemId])
        promises.push(firestore.collection(str.refItem).where(str.fieldItemId, 'in', itemIds).get())

        // Get user's details
        promises.push(firestore.collection(str.refUser).doc(customerId).get())

        // Get business details
        promises.push(firestore.collection(str.refBusiness).doc(businessRefId).get())

        // If user has already reviewed the order, get the user's order review
        // todo: this filter is not needed anymore, since we added the review to the order itself
        promises.push(firestore.collection(str.refReview)
            .where(str.fieldOrder, '==', orderId)
            .where(str.fieldCustomer, '==', customerId)
            .where(str.fieldReviewType, '==', str.valueReviewTypeOrderByCustomer).get())

        // If delivery isn't null, get delivery details
        let hasDelivery = false
        if (order.get(str.fieldDelivery) != null) {
            hasDelivery = true
            promises.push(firestore.collection(str.refUser).doc(order.get(str.fieldDelivery)[str.fieldUserId]).get())
        }

        const tr = await Promise.all(promises)
        tr[0].forEach(doc => itemResponse.push(new BusinessItemV4(doc.data())))
        finalResponse[str.fieldItems] = itemResponse
        finalResponse[str.fieldCustomer] = new UserV3(tr[1].data() as DocumentSnapshot)
        finalResponse[str.refBusiness] = new BusinessV2a(tr[2].data() as DocumentSnapshot)
        if (tr[3].empty) finalResponse[str.refReview] = {}
        else finalResponse[str.refReview] = tr[3].docs[0].data()
        if (hasDelivery) finalResponse[str.fieldDelivery] = new UserV3(tr[4].data() as DocumentSnapshot)
        else finalResponse[str.fieldDelivery] = {}

        return response.status(200).send(JSON.stringify(finalResponse))
    } catch (error) {
        console.error(error)
        return response.status(400).send()
    }
});


exports.onCreateOrder = functions.firestore.document('order/{orderId}').onCreate(async (snap, context) => {
    try {
        let promises: any[] = []

        // Get the customer and business ids from the order and get their documents
        const customerId = snap.get(str.fieldCustomer)[str.fieldUserId]
        const businessRefId = snap.get(str.fieldBusiness)[str.fieldBusinessRefId]
        promises.push(firestore.collection(str.refUser).doc(customerId).get())
        promises.push(firestore.collection(str.refBusiness).doc(businessRefId).get())
        const result = await Promise.all(promises)
        const customer = result[0].data()
        const business = result[1]

        const notification = { title: 'New Order', body: 'You have a new order from ' + customer[str.fieldDisplayName] }

        // Send order notification to the business; and update the order as active order
        await Promise.all([firestore.collection(str.refOrder).doc(snap.id).update({ isActiveOrder: true }), NotificationSender.toOSB(business, notification)])
    } catch (error) {
        console.error(error)
    }
});


exports.onUpdateOrder = functions.firestore.document('order/{orderId}').onUpdate(async (change, context) => {
    try {
        // todo: Ignore execution for on create order
        // todo: check is the order is active or not; terminate further executions for inactive orders 
        // todo: add is deliverable order

        let notiBody
        let notiTitle
        let isActiveOrder = false
        let isDeliverableOrder = false
        let unknownStatusChanged = false

        // *1 -> Identify what kind of order status changes to notify the customer
        const oldStatus = change.before.get(str.fieldStatus)
        const newStatus = change.after.get(str.fieldStatus)
        if (oldStatus != newStatus) {
            // Order status has changed; prepare to push notification

            if (oldStatus === OrderStatus.ORDERED && newStatus === OrderStatus.ACCEPTED) {
                notiTitle = 'Order Accepted'
                notiBody = 'has been accepted.'
                isActiveOrder = true
                isDeliverableOrder = true
            } else if (oldStatus === OrderStatus.ACCEPTED && newStatus === OrderStatus.PREPARING) {
                notiTitle = 'Order Preparing'
                notiBody = 'is preparing'
                isActiveOrder = true
                isDeliverableOrder = true
            } else if (oldStatus === OrderStatus.PREPARING && newStatus == OrderStatus.READY) {
                notiTitle = 'Order Ready'
                notiBody = "is ready"
                isActiveOrder = true
                isDeliverableOrder = true
            } else if (oldStatus === OrderStatus.READY && newStatus === OrderStatus.ON_THE_WAY) {
                notiTitle = 'Out for Delivery'
                notiBody = "is on it's way"
                isActiveOrder = true
                isDeliverableOrder = false
            } else if (oldStatus !== OrderStatus.DELIVERED && newStatus === OrderStatus.DELIVERED) {
                notiTitle = 'Order Delivered'
                notiBody = 'has been delivered'
                isActiveOrder = false
                isDeliverableOrder = false
            } else if (oldStatus !== OrderStatus.CANCELED && newStatus === OrderStatus.CANCELED) {
                notiTitle = 'Order Cancel'
                notiBody = 'has been canceled.'
                isActiveOrder = false
                isDeliverableOrder = false
            } else {
                isActiveOrder = false
                isDeliverableOrder = false
                unknownStatusChanged = true
                console.warn('Unknown order status changed from **' + oldStatus + ' to **' + newStatus)
            }

        }

        const customer = await firestore.collection(str.refUser).doc(change.before.get(str.fieldCustomer)[str.fieldUserId]).get()

        // *2 -> Notify customer and business on delivery changes
        // todo


        if (!unknownStatusChanged) {
            const notification = { tag: change.before.id, title: notiTitle, body: 'Your order from ' + change.before.get(str.fieldBusiness)[str.fieldDisplayName] + ' ' + notiBody }
            await NotificationSender.toOS(customer, notification)
        }

        // *3 -> Update the order active status, whether is it an currently active order or not
        await firestore.collection(str.refOrder).doc(change.before.id).update({ isActiveOrder: isActiveOrder, isDeliverableOrder: isDeliverableOrder })
    } catch (error) {
        console.error(error)
    }
});