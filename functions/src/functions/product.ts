import admin = require('firebase-admin');
import * as functions from 'firebase-functions';
import * as str from '../resources/string';
import { TextUtils } from '../utils/textutil';
import { ListUtils } from '../utils/listutils';
import { Utils } from '../utils/utils';

const firestore = admin.firestore();

/**
 * 1 -> If delete: No execution
 * 2 -> If archive status changed: Update product count (product, activeProductCount) on business doc
 * 3 -> AdminBlocked check
 * 4 -> IsActive check
 * 5 -> Keyword update on item info changed
 * 6 -> Update business and product
 */
exports.onWriteProduct = functions.firestore.document(str.refItem + '/{id}').onWrite(async (change, context) => {
  if (!change.after.exists) {
    // Decrement product count and active product count to the belonging business
    // * By the time this method was implemented there was no option to delete a product
    return
  }

  await firestore.runTransaction(async t => {
    let busiUpdateReq = false
    let productUpdateReq = false
    const updatedBusiness: any = {}
    const updatedProduct: any = {}

    const afterDoc = change.after
    const beforeDoc = change.before
    const businessRefId = afterDoc.get(str.fieldBusinessRefId)
    const business = await t.get(firestore.collection(str.refBusiness).doc(businessRefId))
    const productCount = Utils.isEmpty(business.get(str.fieldProductCount)) ? 1 : business.get(str.fieldProductCount)
    const activeProductCount = Utils.isEmpty(business.get(str.fieldActiveProductCount)) ? 1 : business.get(str.fieldActiveProductCount)

    // * Set up product count to business
    if (!beforeDoc.exists) {
      // Increment product count and active product count to the belonging business
      busiUpdateReq = true
      updatedBusiness.productCount = productCount
      updatedBusiness.activeProductCount = activeProductCount
    } else {
      // Check whether the product has been archive or not in the previous changes
      const preArchived = Utils.isEmpty(beforeDoc.get(str.fieldArchived)) ? false : beforeDoc.get(str.fieldArchived)
      const postArchived = Utils.isEmpty(afterDoc.get(str.fieldArchived)) ? false : afterDoc.get(str.fieldArchived)
      if (preArchived != postArchived) {
        if (preArchived == false && postArchived == true) {
          // Product has been archived
          busiUpdateReq = true
          updatedBusiness.activeProductCount = activeProductCount - 1
        } else if (preArchived == true && postArchived == false) {
          // Product has removed from archived
          busiUpdateReq = true
          updatedBusiness.activeProductCount = activeProductCount + 1
        }
      }
    }



    // * -> Business isOpen status
    if (Utils.isEmpty(afterDoc.get(str.fieldIsBusinessOpen))) {
      productUpdateReq = true
      updatedProduct[str.fieldIsBusinessOpen] = true
    }
    // * -> 



    // * adminBlocked checks
    // Add adminBlocked property if not exist in the product doc
    if (Utils.isEmpty(afterDoc.get(str.fieldAdminBlocked))) {
      productUpdateReq = true
      updatedProduct[str.fieldAdminBlocked] = false
    }


    // * isActive checks
    // Required fields: imageUrls (min length 1), itemName, price
    // price -> price, quantity, unit
    let isActiveProduct = false
    console.log('Product name: ', TextUtils.isEmpty(afterDoc.get(str.fieldItemName)))
    if (!ListUtils.isEmpty(afterDoc.get(str.fieldImageUrls)) && !TextUtils.isEmpty(afterDoc.get(str.fieldItemName))
      && !Utils.isEmpty(afterDoc.get(str.fieldPrice))) {
      const productPrice = afterDoc.get(str.fieldPrice)
      if (!Utils.isEmpty(productPrice[str.fieldPrice]) && !Utils.isEmpty(productPrice[str.fieldQuantity])
        && !Utils.isEmpty(productPrice[str.fieldUnit])) {
        isActiveProduct = true
      }
    }
    if (afterDoc.get(str.fieldIsActive) != isActiveProduct) {
      productUpdateReq = true
      updatedProduct[str.fieldIsActive] = isActiveProduct
    }


    // * Product keyword update
    let productName: string = TextUtils.isEmpty(afterDoc.get(str.fieldItemName)) ? '' : afterDoc.get(str.fieldItemName);
    let productCategory: string = TextUtils.isEmpty(afterDoc.get(str.fieldCategory)) ? '' : afterDoc.get(str.fieldCategory);
    const oldProductName = beforeDoc.exists ? beforeDoc.get(str.fieldItemName) : undefined
    const oldProductCategory = beforeDoc.exists ? beforeDoc.get(str.fieldCategory) : undefined
    const keywords: string[] = []
    if (oldProductName != productName || oldProductCategory != productCategory) {
      // Product category or name has change
      // Recreate the search keywords
      productUpdateReq = true

      productName = productName.trim().toLowerCase()
      keywords.push.apply(keywords, Utils.buttomBiteSubString(productName))
      keywords.push.apply(keywords, Utils.topBiteSubString(productName))
      productName.split(' ').forEach(word => keywords.push.apply(keywords, Utils.buttomBiteSubString(word)))

      if (!Utils.isEmpty(productCategory)) {
        productCategory = productCategory.trim().toLowerCase()
        keywords.push.apply(keywords, Utils.buttomBiteSubString(productCategory))
        keywords.push.apply(keywords, Utils.topBiteSubString(productCategory))
        productCategory.split(' ').forEach(word => keywords.push.apply(keywords, Utils.buttomBiteSubString(word)))
      }

      updatedProduct[str.keyKeywords] = ListUtils.removeDuplicate(keywords)
    }


    // * -> Update product categories
    const pc = afterDoc.get(str.fieldCategory)
    if (!TextUtils.isEmpty(pc)) {
      const pcList = business.get(str.fieldProductCategories)
      if (ListUtils.isEmpty(pcList)) {
        // Adding a product category for the first time
        busiUpdateReq = true
        updatedBusiness[str.fieldProductCategories] = [pc]
      } else {
        const isExist = pcList.find(c => c.toLocaleLowerCase() == pc.toLocaleLowerCase())
        if (Utils.isEmpty(isExist)) {
          // New product category added
          busiUpdateReq = true
          updatedBusiness[str.fieldProductCategories] = admin.firestore.FieldValue.arrayUnion(pc)
        }
      }
    }



    // * Update business and product
    // Update required condition is use to reduce the no. of database writes
    if (busiUpdateReq) t.update(firestore.collection(str.refBusiness).doc(businessRefId), updatedBusiness)
    if (productUpdateReq) t.update(firestore.collection(str.refItem).doc(afterDoc.id), updatedProduct)

    console.log('---------------------------')
    console.log('Business updates: ', updatedBusiness)
    console.log('Product updates: ', updatedProduct)
  })
})
