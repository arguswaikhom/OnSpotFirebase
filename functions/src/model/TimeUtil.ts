export class TimeUtil {

    static getTime(obj) {
        let hour = obj.hour
        const min = obj.minute
        const zone = obj.zone

        if (zone == 'PM') {
            hour = hour + 12
        }

        return hour + (min / 60)
    }
}