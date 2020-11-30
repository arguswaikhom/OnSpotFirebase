import admin = require('firebase-admin');

export class Utils {
  public static isEmpty(obj) {
    return obj == undefined || obj == null
  }

  public static topBiteSubString(txt: string) {
    const charList: string[] = []
    for (let i = 0; i < txt.length - 1; i++) {
      if (txt[i] != ' ') charList.push(txt.substring(i, txt.length))
    }
    return charList;
  }

  public static buttomBiteSubString(txt: string) {
    const charList: string[] = []
    for (let i = 1; i < txt.length + 1; i++) {
      if (txt[i - 1] != ' ') charList.push(txt.substring(0, i))
    }
    return charList
  }

  public static getTimeNow() {
    return admin.firestore.Timestamp.fromDate(new Date())
  }
}