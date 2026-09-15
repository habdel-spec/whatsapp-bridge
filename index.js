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
            '--single-process',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    qrcode.toDataURL(qr, (err, url) => { qrCodeData = url; });
});

client.on('ready', () => {
    isReady = true;
    qrCodeData = '';
    console.log('WhatsApp Ready!');
});

client.initialize();

app.get('/', (req, res) => {
    if (isReady) return res.send('<h2>الواتساب متصل وجاهز ✅</h2>');
    if (qrCodeData) return res.send(`<h2>امسح الـ QR Code:</h2><img src="${qrCodeData}"/>`);
    res.send('جاري التحميل... أعد تحديث الصفحة بعد ثوانٍ.');
});

app.post('/send', async (req, res) => {
    const { phone, message } = req.body;
    try {
        await client.sendMessage(phone + '@c.us', message);
        res.status(200).json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ status: 'error', error: err.message });
    }
});

app.listen(process.env.PORT || 3000);
