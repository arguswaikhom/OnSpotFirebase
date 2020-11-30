import admin = require('firebase-admin');
import * as functions from 'firebase-functions';
import * as str from '../resources/string';
import { ListUtils } from '../utils/listutils';
import { OSClass } from '../utils/enum';
import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';
import { Utils } from '../utils/utils';

const firestore = admin.firestore();

// todo: filter only live and non admin blocked item 
exports.getExplore = functions.https.onRequest(async (request, response) => {
  try {
    const responseLength = 50
    const promises: any[] = []
    const businessCol = firestore.collection(str.refBusiness)
    const itemCol = firestore.collection(str.refItem)
    let searchKeywords = request.body.keywords
    if (Utils.isEmpty(searchKeywords)) {
      promises.push(businessCol.get());
      promises.push(itemCol.get());
    } else {
      searchKeywords = searchKeywords.trim().toLowerCase()
      promises.push(businessCol.where(str.keyKeywords, 'array-contains', searchKeywords).limit(responseLength).get())
      promises.push(itemCol.where(str.keyKeywords, 'array-contains', searchKeywords).limit(responseLength).get())
    }
    const result = await Promise.all(promises);
    let bussNItems: DocumentSnapshot[] = []
    result.forEach(snapshot => {
      if (!Utils.isEmpty(snapshot) && !snapshot.empty) {
        bussNItems.push.apply(bussNItems, snapshot.docs)
      }
    });

    bussNItems = ListUtils.shuffle(bussNItems)
    const responseList: any = []
    for (let i = 0; responseList.length < responseLength && i < bussNItems.length; i++) {
      const doc = bussNItems[i]
      const imageUrls = doc.get(str.fieldImageUrls)
      if (!ListUtils.isEmpty(imageUrls)) {
        responseList.push({
          id: doc.id,
          osClass: doc.get(str.fieldOsClass),
          imageUrl: imageUrls[0]
        })
      }
    }
    console.log('Total items response: ', responseList.length)
    return response.status(200).send(JSON.stringify(responseList))
  } catch (error) {
    console.error(error)
    return response.status(400).send()
  }
})

exports.getExploreSearch = functions.https.onRequest(async (request, response) => {
  try {
    const responseLength = 50
    const promises: any[] = []
    promises.push(firestore.collection(str.refBusiness).get());
    promises.push(firestore.collection(str.refItem).get());
    const result = await Promise.all(promises);
    let bussNItems: DocumentSnapshot[] = []
    result.forEach(snapshot => {
      if (!snapshot.empty) {
        bussNItems.push.apply(bussNItems, snapshot.docs)
      }
    });

    bussNItems = ListUtils.shuffle(bussNItems)
    const responseList: any = []
    for (let i = 0; responseList.length < responseLength && i < bussNItems.length; i++) {
      const doc = bussNItems[i]
      const imageUrls = doc.get(str.fieldImageUrls)
      if (!ListUtils.isEmpty(imageUrls)) {
        responseList.push({
          id: doc.id,
          osClass: doc.get(str.fieldOsClass),
          imageUrl: imageUrls[0]
        })
      }
    }
    console.log('Total items response: ', responseList.length)
    return response.status(200).send(JSON.stringify(responseList))
  } catch (error) {
    console.error(error)
    return response.status(400).send()
  }
})