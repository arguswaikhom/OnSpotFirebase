export class ListUtils {
  public static isEmpty(ls) {
    return ls == undefined || ls == null || ls.length == 0
  }

  public static shuffle(array) {
    let currentIndex = array.length, temporaryValue, randomIndex;
    while (0 !== currentIndex) {
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;

      // And swap it with the current element.
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }
    return array;
  }

  public static removeDuplicate(list) {
    return list.filter(function (elem, index, self) {
      return index === self.indexOf(elem);
    })
  }
}