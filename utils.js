import moment from 'moment-timezone';

const PKT_TIMEZONE = 'Asia/Karachi';
const DXB_TIMEZONE = 'Asia/Dubai';

export const getTimezone = (time = moment(), timezone = PKT_TIMEZONE) => {
    const m = moment(time).tz(timezone);
    return m.isValid() ? m : moment().tz(timezone);
};

export const isWeekend = (timezone = PKT_TIMEZONE) => {
    const currentTime = getTimezone(moment(), timezone);
    const dayOfWeek = currentTime.day(); // 0 = Sunday, 6 = Saturday
    return dayOfWeek === 0 || dayOfWeek === 6;
};

export const isMaintenanceWindow = (startHour = 2, endHour = 3, timezone = PKT_TIMEZONE) => {
    const currentTime = getTimezone(moment(), timezone);
    const hours = currentTime.hours();
    return hours >= startHour && hours < endHour;
};