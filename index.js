process.env.PUPPETEER_CACHE_DIR = '/opt/render/project/src/.cache';

const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

const app = express();
app.use(express.json());

let qrCodeData = '';
let isReady = false;

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-component-update',
            '--disable-default-apps',
            '--renderer-process-limit=1',
            '--js-flags="--max-old-space-size=128"'
        ]
    }
});

client.on('qr', (qr) => {
    isReady = false;
    qrcode.toDataURL(qr, (err, url) => { qrCodeData = url; });
});

client.on('ready', () => {
    isReady = true;
    qrCodeData = '';
    console.log('WhatsApp Ready!');
});

client.on('authenticated', () => console.log('Authenticated!'));
client.on('auth_failure', () => { isReady = false; });
client.on('disconnected', () => { isReady = false; });

client.initialize();

app.get('/', (req, res) => {
    if (isReady) {
        return res.send('<h2 style="color:green;text-align:center;font-family:sans-serif;margin-top:50px;">الواتساب متصل وجاهز ✅</h2>');
    }
    if (qrCodeData) {
        return res.send(`
            <div style="text-align:center;font-family:sans-serif;margin-top:30px;">
                <meta http-equiv="refresh" content="12">
                <h2>امسح الـ QR Code الآن:</h2>
                <img src="${qrCodeData}" style="width:250px;height:250px;"/>
                <p style="color:gray;">الصفحة تتحدث تلقائياً للحفاظ على صلاحية الرمز...</p>
            </div>
        `);
    }
    res.send('<div style="text-align:center;font-family:sans-serif;margin-top:50px;"><meta http-equiv="refresh" content="5"><h2>جاري تجهيز السيرفر... انتظر ثوانٍ</h2></div>');
});

app.post('/send', async (req, res) => {
    if (!isReady) {
        return res.status(503).json({ status: 'error', error: 'السيرفر غير جاهز بعد' });
    }
    const { phone, message } = req.body;
    try {
        const sanitizedPhone = phone.replace(/[^0-9]/g, '');
        const numberDetails = await client.getNumberId(sanitizedPhone);
        
        if (!numberDetails) {
            return res.status(400).json({ status: 'error', error: 'الرقم غير مسجل على الواتساب' });
        }
        
        await client.sendMessage(numberDetails._serialized, message);
        res.status(200).json({ status: 'success' });
    } catch (err) {
        console.error('Send error:', err);
        res.status(500).json({ status: 'error', error: err.message });
    }
});

app.listen(process.env.PORT || 3000);
