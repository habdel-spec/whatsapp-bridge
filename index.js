const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');
const fs = require('fs');

const app = express();
app.use(express.json());

let sock = null;
let qrCodeData = '';
let isReady = false;

async function connectToWhatsApp() {
    try {
        console.log('Fetching latest WhatsApp Web version...');
        const { version } = await fetchLatestBaileysVersion();
        console.log(`Using WA Web version: ${version.join('.')}`);

        const { state, saveCreds } = await useMultiFileAuthState('auth_baileys_session');
        
        sock = makeWASocket({
            version,
            auth: state,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: ["Ubuntu", "Chrome", "20.0.04"]
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                isReady = false;
                qrCodeData = await qrcode.toDataURL(qr);
                console.log('✅ New QR Generated!');
            }

            if (connection === 'open') {
                isReady = true;
                qrCodeData = '';
                console.log('✅ WhatsApp Ready (Baileys)!');
            }

            if (connection === 'close') {
                isReady = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log('Connection closed, status:', statusCode);
                
                if (statusCode === 405 || statusCode === 401 || statusCode === DisconnectReason.loggedOut) {
                    console.log('Cleaning invalid session files...');
                    try { fs.rmSync('auth_baileys_session', { recursive: true, force: true }); } catch (e) {}
                }
                
                setTimeout(connectToWhatsApp, 3000);
            }
        });
    } catch (err) {
        console.error('❌ Connection init error:', err);
        setTimeout(connectToWhatsApp, 5000);
    }
}

connectToWhatsApp();

app.get('/', (req, res) => {
    if (isReady) {
        return res.send('<h2 style="color:green;text-align:center;font-family:sans-serif;margin-top:50px;">الواتساب متصل وجاهز ✅ (Baileys)</h2>');
    }
    if (qrCodeData) {
        return res.send(`
            <div style="text-align:center;font-family:sans-serif;margin-top:30px;">
                <meta http-equiv="refresh" content="10">
                <h2>امسح الـ QR Code الآن:</h2>
                <img src="${qrCodeData}" style="width:250px;height:250px;"/>
                <p style="color:gray;">الصفحة تتحدث تلقائياً للحفاظ على صلاحية الرمز...</p>
            </div>
        `);
    }
    res.send(`
        <div style="text-align:center;font-family:sans-serif;margin-top:50px;">
            <meta http-equiv="refresh" content="5">
            <h2>جاري تجهيز السيرفر... انتظر ثوانٍ</h2>
            <p style="margin-top:20px;"><a href="/reset" style="color:red;text-decoration:none;font-weight:bold;">اضغط هنا لمسح الجلسة القديمة وإظهار الـ QR Code 🔄</a></p>
        </div>
    `);
});

app.get('/reset', (req, res) => {
    try {
        if (sock) {
            try { sock.end(); } catch(e){}
        }
        fs.rmSync('auth_baileys_session', { recursive: true, force: true });
        isReady = false;
        qrCodeData = '';
        setTimeout(connectToWhatsApp, 1000);
        res.send('<div style="text-align:center;font-family:sans-serif;margin-top:50px;"><h2>تم تفريغ الجلسة القديمة بنجاح! جاري إظهار الـ QR جديد...</h2><script>setTimeout(() => { window.location.href = "/"; }, 3000);</script></div>');
    } catch (err) {
        res.send('حدث خطأ أثناء إعادة الضبط: ' + err.message);
    }
});

app.post('/send', async (req, res) => {
    if (!isReady || !sock) {
        return res.status(503).json({ status: 'error', error: 'السيرفر غير جاهز بعد' });
    }
    const { phone, message } = req.body;
    try {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const jid = `${cleanPhone}@s.whatsapp.net`;
        
        await sock.sendMessage(jid, { text: message });
        res.status(200).json({ status: 'success' });
    } catch (err) {
        console.error('Send error:', err);
        res.status(500).json({ status: 'error', error: err.message });
    }
});

app.listen(process.env.PORT || 3000, () => console.log('Server running...'));
