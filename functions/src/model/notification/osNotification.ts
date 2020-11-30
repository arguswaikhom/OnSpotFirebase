import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';
import * as str from '../../resources/string';

export class OSNotificationV0 {
  id; createdAt

  constructor(doc: DocumentSnapshot) {
    this.id = doc.id
    this.createdAt = doc[str.fieldCreatedAt]
  }
}

export class OSDeliveryPartnershipRequest extends OSNotificationV0 {
  osd; osb; status;

  constructor(doc: DocumentSnapshot) {
    super(doc);
    this.osd = doc[str.fieldOsd]
    this.osb = doc[str.fieldOsb]
    this.status = doc[str.fieldStatus]
  }
}