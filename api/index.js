import moment from 'moment';

export default async function handler(req, res) {
    const uptimeInSeconds = process.uptime();
    const uptime = moment.duration(uptimeInSeconds, 'seconds').humanize() + ' ago';

    // Completely Open CORS
    res.setHeader('Access-Control-Allow-Origin', '*');

    await sendAlert();
    await sendLog();

    return res.status(200).json({
        status: "OK",
        uptime: uptime,
        timestamp: new Date().toISOString()
    });
}