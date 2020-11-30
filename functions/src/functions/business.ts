import admin = require('firebase-admin');
import * as functions from 'firebase-functions';
import * as str from '../resources/string';
import { TextUtils } from '../utils/textutil';
import { ListUtils } from '../utils/listutils';
import { Utils } from '../utils/utils';
import { DistanceUtil } from '../model/DistanceUtil';
import { OSAPOnSpotHomeHODFilter } from '../utils/enum';
import { BusinessV2a } from '../model/business/businessV2a';
import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';
import { BusinessV4 } from '../model/business/businessV4';

const firestore = admin.firestore();

/**
 * If one of the require field is missing, the business will be inactive
 */
exports.onWriteBusiness = functions.firestore.document(str.refBusiness + '/{id}').onWrite(async (change, context) => {
  if (!change.after.exists) return

  let businessUpdateReqd = false
  let productsUpdateReqd = false
  const updatedBusiness: any = {}
  const updatedProducts: any = {}
  const before = change.before
  const after = change.after

  // * 1-> Business keyword update
  let displayName: string = after.get(str.fieldDisplayName)
  let businessType: string = after.get(str.fieldBusinessType)
  const oldDisplayName = change.before.exists ? change.before.get(str.fieldDisplayName) : undefined
  const oldBusinessType = change.before.exists ? change.before.get(str.fieldBusinessType) : undefined
  const keywords: string[] = []
  if (oldDisplayName != displayName || oldBusinessType != businessType) {
    // Business category or name has change
    // Recreate the search keywords

    displayName = displayName.trim().toLowerCase()
    keywords.push.apply(keywords, Utils.buttomBiteSubString(displayName))
    keywords.push.apply(keywords, Utils.topBiteSubString(displayName))
    displayName.split(' ').forEach(word => keywords.push.apply(keywords, Utils.buttomBiteSubString(word)))

    if (!Utils.isEmpty(businessType)) {
      businessType = businessType.trim().toLowerCase()
      keywords.push.apply(keywords, Utils.buttomBiteSubString(businessType))
      keywords.push.apply(keywords, Utils.topBiteSubString(businessType))
      businessType.split(' ').forEach(word => keywords.push.apply(keywords, Utils.buttomBiteSubString(word)))
    }
  }

  if (keywords.length != 0) {
    businessUpdateReqd = true
    updatedBusiness[str.fieldKeywords] = ListUtils.removeDuplicate(keywords)
  }
  // * -> 1



  // * 2 -> Business isOpen status
  // The business item should know whether their business is open or close
  if (Utils.isEmpty(after.get(str.fieldIsOpen))) {
    businessUpdateReqd = true
    updatedBusiness[str.fieldIsOpen] = true
  } else if (before.exists && before.get(str.fieldIsOpen) != after.get(str.fieldIsOpen)) {
    // If the business open status changed, update it to all the business items
    productsUpdateReqd = true
    updatedProducts[str.fieldIsBusinessOpen] = after.get(str.fieldIsOpen)
  }
  // * -> 2



  // * 3 -> Business adminBlocked checks
  // Add adminBlocked property if not exist in the product doc
  if (Utils.isEmpty(after.get(str.fieldAdminBlocked))) {
    businessUpdateReqd = true
    updatedBusiness[str.fieldAdminBlocked] = false
  } else if (before.exists && before.get(str.fieldAdminBlocked) != after.get(str.fieldAdminBlocked)) {
    productsUpdateReqd = true
    updatedProducts[str.fieldIsBusinessAdminBlocked] = after.get(str.fieldAdminBlocked)
  }
  // * -> 3



  // * 4 -> Business isActive status
  // required fields {display name, 1 image min, hod availability, location, mobile no}
  let isActiveBusiness = true
  if (TextUtils.isEmpty(after.get(str.fieldDisplayName)) || ListUtils.isEmpty(after.get(str.fieldImageUrls)) ||
    Utils.isEmpty(after.get(str.fieldHodAvailable)) || Utils.isEmpty(after.get(str.fieldLocation)) || Utils.isEmpty(after.get(str.fieldMobileNumber))) {
    isActiveBusiness = false
  }

  // if hod available delivery range is requiered
  if (!Utils.isEmpty(after.get(str.fieldHodAvailable)) && after.get(str.fieldHodAvailable) == true) {
    if (Utils.isEmpty(after.get(str.fieldDeliveRange))) isActiveBusiness = false

    // If free shipping is not available, shipping charge is require
    if (after.get(str.fieldFsAvailable) == false) {
      if (Utils.isEmpty(after.get(str.fieldShippingCharges))) isActiveBusiness = false
      else if (Utils.isEmpty(after.get(str.fieldShippingCharges)[str.fieldPerOrder])) isActiveBusiness = false
    }
  }

  if (isActiveBusiness != after.get(str.fieldIsActive)) {
    businessUpdateReqd = true
    updatedBusiness[str.fieldIsActive] = isActiveBusiness
    productsUpdateReqd = true
    updatedProducts[str.fieldIsBusinessActive] = isActiveBusiness
  }
  // * -> 4


  const promises: any[] = []
  if (businessUpdateReqd) promises.push(firestore.collection(str.refBusiness).doc(after.id).update(updatedBusiness))
  if (productsUpdateReqd) {
    const products = await firestore.collection(str.refItem).where(str.fieldBusinessRefId, '==', after.id).get()
    products.forEach(doc => promises.push(firestore.collection(str.refItem).doc(doc.id).update(updatedProducts)))
  }
  if (promises.length != 0) await Promise.all(promises)

  console.log(updatedProducts)
  console.log(updatedBusiness)
})



/**
 * Get all the business relavent to the user's current location
 */
export const getUserBusiness = functions.https.onRequest(async (request, response) => {
  try {
    const centerGP = JSON.parse(request.body.userLocation) as admin.firestore.GeoPoint
    const filter = request.body.filter

    // get common delivery range from the database 
    let radius, limit
    if (filter == OSAPOnSpotHomeHODFilter.OPEN_ALL_BUSINESS) {
      radius = 100
      limit = 50
    } else {
      limit = 100
      radius = (await firestore.collection(str.refCrownOnspot).doc(str.fieldDeliveRange).get()).get('value')
    }

    /** find all the business which are in the common delivery range from the user's location */
    const box = DistanceUtil.boundingBoxCoordinates(centerGP, radius);
    const lesserGP = new admin.firestore.GeoPoint(box.swCorner.latitude, box.swCorner.longitude);
    const greaterGP = new admin.firestore.GeoPoint(box.neCorner.latitude, box.neCorner.longitude);

    const fieldPath = new admin.firestore.FieldPath('location', 'geoPoint')
    const query = firestore.collection(str.refBusiness).where(fieldPath, '>', lesserGP).where(fieldPath, '<', greaterGP)
      .where(str.fieldIsOpen, '==', true).where(str.fieldIsActive, '==', true)
      .where(str.fieldAdminBlocked, '==', false)

    const businessList: any[] = []
    if (filter == OSAPOnSpotHomeHODFilter.ONLY_HOD_BUSINESS) {
      const snapshot = await query.where(str.fieldHodAvailable, '==', true).limit(limit).get()
      snapshot.forEach(business => {
        /** Find the distance between user and business location */
        const businessGP = business.get('location').geoPoint
        const distance = DistanceUtil.distance(businessGP, centerGP)

        /** If the distance is more than business's delivery range, do not include */
        const deliveryRange = business.get('deliveryRange') == null ? null : business.get('deliveryRange')
        if (deliveryRange == null || distance <= deliveryRange) businessList.push(new BusinessV4(business.data() as DocumentSnapshot))
      })
    } else {
      const snapshot = await query.limit(limit).get()
      snapshot.forEach(business => businessList.push(new BusinessV4(business.data() as DocumentSnapshot)))
    }

    console.log('Total: ', businessList.length)
    return response.status(200).send({ filter: filter, data: businessList })
  } catch (error) {
    console.error(error)
    return response.status(400).send()
  }
})