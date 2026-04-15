const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'], // VPS එකක දුවන නිසා මෙය අත්‍යවශ්‍යයි
    }
});

client.on('qr', (qr) => {
    qrcode.generate(qr, {small: true});
    console.log('ඉහත QR code එක scan කරන්න.');
});

client.on('ready', () => {
    console.log('Bot එක සාර්ථකව වැඩ ආරම්භ කළා!');
});

client.on('message', async (message) => {
    const text = message.body.toLowerCase();

    if (text === 'hi' || text === 'hello') {
        await client.sendMessage(message.from, `Hello! ඔබට උදව් කරන්නේ කොහොමද?`);
    } 
    else if (text === 'price') {
        await client.sendMessage(message.from, `අපගේ සේවාවන් රු. 1000 සිට ආරම්භ වේ. වැඩි විස්තර සඳහා අප අමතන්න.`);
    }
    else if (text === 'location') {
        await client.sendMessage(message.from, `අපි ඉන්නේ කොළඹ.`);
    }
});

client.initialize();
