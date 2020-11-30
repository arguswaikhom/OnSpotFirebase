import admin = require('firebase-admin');
import * as functions from 'firebase-functions';
import * as str from '../resources/string';
import { OSRUItemByCustomer } from '../model/review/osruItemByCustomer';
import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';
import { OSRUDeliveryByCustomer } from '../model/review/osru-delivery-by-customer';
import { OSReviewType } from '../utils/enum';
import { OSRating } from '../model/osRating';
import { Utils } from '../utils/utils';

const firestore = admin.firestore();

exports.getOrderCustomerReview = functions.https.onRequest(async (request, response) => {
  try {
    const promises: any[] = []
    const orderId = request.body.orderId
    let finalResponse = {}

    // Get order details
    const order = await firestore.collection(str.refOrder).doc(orderId).get()

    // Get details of all the items in the order
    const itemIds: any[] = []
    const orderItems = order.get(str.fieldItems)
    for (let i = 0; i < orderItems.length; i++) itemIds.push(orderItems[i][str.fieldItemId])

    // Get all the item review (reviewed by the customer) of this order 
    const customerId = order.get(str.fieldCustomer)[str.fieldUserId]
    promises.push(firestore.collection(str.refReview)
      .where(str.fieldCustomer, '==', customerId)
      .where(str.refItem, 'in', itemIds)
      .where(str.fieldReviewType, '==', str.valueReviewTypeItemByCustomer).get())

    // Get delivery review by customer
    promises.push(firestore.collection(str.refReview)
      .where(str.fieldOrder, '==', orderId)
      .where(str.fieldReviewType, '==', str.valueReviewTypeDeliveryByCustomer)
      // The below two 'where' is not actucally require
      .where(str.fieldCustomer, '==', customerId)
      .where(str.fieldBusiness, '==', order.get(str.fieldBusiness)[str.fieldBusinessRefId])
      .get())

    const result = await Promise.all(promises)

    // Add order item review to the response
    if (result[0].empty) finalResponse[str.keyItemReview] = []
    else {
      let finalReviews: any[] = []
      result[0].forEach(doc => finalReviews.push(new OSRUItemByCustomer(doc.data() as DocumentSnapshot)))
      finalResponse[str.keyItemReview] = finalReviews;
    }

    // Add delivery review to the response
    if (result[1].empty) finalResponse[str.keyDeliveryReview] = {}
    else {
      finalResponse[str.keyDeliveryReview] = new OSRUDeliveryByCustomer(result[1].docs[0].data() as DocumentSnapshot);
    }

    console.log(JSON.stringify(finalResponse))
    return response.status(200).send(JSON.stringify(finalResponse))
  } catch (error) {
    console.error(error)
    return response.status(400).send()
  }
})

function getUpdatedRating(osRating, newValue, oldValue) {
  if (Utils.isEmpty(osRating) || Utils.isEmpty(osRating[str.fieldAverage]) || Utils.isEmpty(osRating[str.fieldCount])) {
    // Review is given for the first time for the entire 'business' or 'user' or 'item' or 'order'
    return JSON.parse(JSON.stringify(new OSRating(newValue, 1)))
  }

  const oldAverage = osRating[str.fieldAverage]
  const oldCount = osRating[str.fieldCount]

  if (oldValue == undefined || oldValue == null) {
    // Happens when a new review doc created 
    const new_average = ((oldAverage * oldCount) + newValue) / (oldCount + 1)
    return JSON.parse(JSON.stringify(new OSRating(new_average, (oldCount + 1))))
  } else {
    // Happens when a review doc updated 
    const new_average = (((oldAverage * oldCount) - oldValue) + newValue) / oldCount
    return JSON.parse(JSON.stringify(new OSRating(new_average, oldCount)))
  }
}

exports.onWriteReview = functions.firestore.document(str.refReview + '/{reviewId}').onWrite(async (change, context) => {
  // * Do not change the flow of the if-else
  // * If you change 'on-delete' and 'on-update' condition; 'on-update' will be 'True' on document deletes

  const isCreateEvent = !change.before.exists
  const isDeleteEvent = !change.after.exists

  // * Review deletion was not allowed by the time this method was created
  if (isDeleteEvent) return

  // Below code will execute for the review docs which was newly created or modified
  const afterDoc = change.after
  const beforeDoc = change.before
  const newRatedValue = afterDoc.get(str.fieldRating)
  let hasChangedRatingValue = true
  if (!isCreateEvent) if (afterDoc.get(str.fieldRating) == beforeDoc.get(str.fieldRating)) hasChangedRatingValue = false

  switch (afterDoc.get(str.fieldReviewType)) {
    case OSReviewType.DELIVERY_BY_CUSTOMER: {
      if (!hasChangedRatingValue) return
      const dUId = afterDoc.get(str.fieldDelivery)
      await firestore.runTransaction(async t => {
        const dUDoc = await t.get(firestore.collection(str.refUser).doc(dUId))
        const deliveryUserRating = dUDoc.get(str.fieldDeliveryRating)
        let updatedRating
        if (isCreateEvent) updatedRating = getUpdatedRating(deliveryUserRating, newRatedValue, null)
        else updatedRating = getUpdatedRating(deliveryUserRating, newRatedValue, beforeDoc.get(str.fieldRating))
        t.update(firestore.collection(str.refUser).doc(dUId), { deliveryRating: updatedRating })
      })
      break;
    }
    case OSReviewType.ITEM_BY_CUSTOMER: {
      if (!hasChangedRatingValue) return
      const itemId = afterDoc.get(str.fieldItem)
      await firestore.runTransaction(async t => {
        const itemDoc = await t.get(firestore.collection(str.refItem).doc(itemId))
        const itemRating = itemDoc.get(str.fieldProductRating)
        let updatedRating
        if (isCreateEvent) updatedRating = getUpdatedRating(itemRating, newRatedValue, null)
        else updatedRating = getUpdatedRating(itemRating, newRatedValue, beforeDoc.get(str.fieldRating))
        t.update(firestore.collection(str.refItem).doc(itemId), { productRating: updatedRating })
      })
      break;
    }
    case OSReviewType.ORDER_BY_CUSTOMER: {
      const orderId = afterDoc.get(str.fieldOrder)
      const bId = afterDoc.get(str.fieldBusiness)
      if (hasChangedRatingValue) {
        await firestore.runTransaction(async t => {
          const bDoc = await t.get(firestore.collection(str.refBusiness).doc(bId))
          const bOrderRating = bDoc.get(str.fieldOrderRating)
          let updatedRating
          if (isCreateEvent) updatedRating = getUpdatedRating(bOrderRating, newRatedValue, null)
          else updatedRating = getUpdatedRating(bOrderRating, newRatedValue, beforeDoc.get(str.fieldRating))
          t.update(firestore.collection(str.refBusiness).doc(bId), { orderRating: updatedRating })
        })
      }
      await firestore.collection(str.refOrder).doc(orderId).update({ orderRating: { reviewId: afterDoc.id, rating: newRatedValue, msg: afterDoc.get(str.fieldMsg) } })
      break;
    }
    case OSReviewType.BUSINESS_BY_CUSTOMER: {
      if (hasChangedRatingValue) {
        await firestore.runTransaction(async t => {
          const bId = afterDoc.get(str.fieldBusiness)
          const bDoc = await t.get(firestore.collection(str.refBusiness).doc(bId))
          const bOrderRating = bDoc.get(str.fieldBusinessRating)
          let updatedRating
          if (isCreateEvent) updatedRating = getUpdatedRating(bOrderRating, newRatedValue, null)
          else updatedRating = getUpdatedRating(bOrderRating, newRatedValue, beforeDoc.get(str.fieldRating))
          t.update(firestore.collection(str.refBusiness).doc(bId), { businessRating: updatedRating })
        })
      }
      break;
    }
  }
})