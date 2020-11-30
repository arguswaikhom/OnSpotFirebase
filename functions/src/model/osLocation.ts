import admin = require("firebase-admin");

export class OSLocation {
  addressLine: string
  geoPoint: admin.firestore.GeoPoint
  postalCode: string
  howToReach: string
}