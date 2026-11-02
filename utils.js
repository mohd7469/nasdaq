import axios from 'axios';
import moment from 'moment-timezone';

const NY_TIMEZONE = "America/New_York";
const PKT_TIMEZONE = 'Asia/Karachi';
const DXB_TIMEZONE = 'Asia/Dubai';

export const getTimezone = (time = moment(), timezone = PKT_TIMEZONE) => {
    const m = moment(time).tz(timezone);
    return m.isValid() ? m : moment().tz(timezone);
};

export const isWeekend = (timezone = PKT_TIMEZONE) => {
    const currentTime = getTimezone(moment(), timezone);
    const day = currentTime.day(); // 0 = Sunday, 6 = Saturday
    return day === 0 || day === 6;
};

export const isMaintenanceWindow = (startHour = 2, endHour = 3, timezone = PKT_TIMEZONE) => {
    const currentTime = getTimezone(moment(), timezone);
    const hours = currentTime.hours();
    return hours >= startHour && hours < endHour;
};

export const validateAction = (action) => {
    const normalizedAction = action.toUpperCase();
    if (normalizedAction !== 'ENTRY' && normalizedAction !== 'EXIT') {
        return { error: '"action" must be ENTRY or EXIT.' };
    }
    return { value: normalizedAction };
}

export const validateSide = (action, side) => {
    if (action === 'ENTRY') {
        const normalizedSide = side?.toUpperCase();
        if (normalizedSide !== 'LONG' && normalizedSide !== 'SHORT') {
            return { error: '"side" must be LONG or SHORT.' };
        }
        return { value: normalizedSide };
    }
    return { value: side };
}

export const formatGMT5 = (time = moment()) => {
    return getTimezone(time).format('YYYY-MM-DDTHH:mm:ss.SSSZ');
};

export const isSignalExpired = (timestamp) => {
    if (timestamp) {
        const signalTime = getTimezone(timestamp);
        const startOfDay = getTimezone().startOf('day');
        if (signalTime.isBefore(startOfDay)) {
            return true;
        }
    }
    return false;
};

// ----------------------------------------------------
// Environment helpers (centralized)
// ----------------------------------------------------
export const isDev = () => {
    const env = process.env.APP_ENV || 'development';
    return Boolean(process.env.API_URL?.includes('dev') || env === 'development');
};

// ----------------------------------------------------
// Reusable Telegram API helpers
// ----------------------------------------------------
export async function sendTelegramMessage(token, chatId, text) {
    try {
        const prefix = isDev() ? '[dev] ' : '';
        const response = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
            chat_id: chatId,
            text: prefix + text,
            parse_mode: 'HTML'
        });
        return { success: true, data: response.data };
    } catch (err) {
        return { success: false, error: err.response?.data || err.message };
    }
}

export async function sendTelegramChatAction(token, chatId, action = 'typing') {
    try {
        const response = await axios.post(`https://api.telegram.org/bot${token}/sendChatAction`, {
            chat_id: chatId,
            action
        });
        return { success: true, data: response.data };
    } catch (err) {
        return { success: false, error: err.response?.data || err.message };
    }
}
