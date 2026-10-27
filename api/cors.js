export default function cors(req, res, options = {}) {
    const {
        origin = '*',
        methods = 'OPTIONS, GET, POST',
        headers = 'Content-Type, Authorization, X-Telegram-Bot-Api-Secret-Token, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version',
        credentials = true
    } = options;

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', methods);
    res.setHeader('Access-Control-Allow-Headers', headers);

    if (credentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    if (req?.method === 'OPTIONS') {
        res.status(200).end();
        return true;
    }

    return false;
}