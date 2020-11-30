import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';
import * as str from '../../resources/string';

export class OSReviewV0 {
  reviewId: string
  msg: string
  rating: number
  reviewType: string

  constructor(doc: DocumentSnapshot) {
    this.reviewId = doc[str.fieldReviewId]
    this.msg = doc[str.fieldMsg]
    this.rating = doc[str.fieldRating]
    this.reviewType = doc[str.fieldReviewType]
  }
}