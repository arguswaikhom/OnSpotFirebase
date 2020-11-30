import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';
import * as str from '../../resources/string';
import { OSReviewV0 } from './osReviewV0';
import admin = require('firebase-admin');

export class OSReviewV1 extends OSReviewV0 {
  createdOn: admin.firestore.Timestamp
  modifiedOn: admin.firestore.Timestamp

  constructor(doc: DocumentSnapshot) {
    super(doc)
    this.createdOn = doc[str.fieldCreatedOn]
    this.modifiedOn = doc[str.fieldModifiedOn]
  }
}