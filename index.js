const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs'); // Database එක හදන්න අවශ්‍ය library එක

// 🔴 ඔබේ පුද්ගලික අංකය මෙතන දෙන්න (අනිවාර්යයෙන්ම 94 න් පටන් ගෙන @c.us වලින් අවසන් විය යුතුයි)
const const ADMIN_NUMBER = '94762375808@c.us'; 
const DB_FILE = __dirname + '/database.json';

// Database එක කියවීම
function getReplies() {
    if (!fs.existsSync(DB_FILE)) return {};
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

// Database එකට අලුත් Reply එකක් ලිවීම
function saveReply(keyword, reply) {
    let replies = getReplies();
    replies[keyword.toLowerCase()] = reply;
    fs.writeFileSync(DB_FILE, JSON.stringify(replies, null, 2));
}

// Database එකෙන් Reply එකක් මැකීම
function deleteReply(keyword) {
    let replies = getReplies();
    delete replies[keyword.toLowerCase()];
    fs.writeFileSync(DB_FILE, JSON.stringify(replies, null, 2));
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    qrcode.generate(qr, {small: true});
});

client.on('ready', () => {
    console.log('✅ Advanced Admin Bot වැඩ ආරම්භ කළා!');
});

client.on('message', async (message) => {
    console.log(`[DEBUG] ආපු නම්බර් එක: ${message.from} | මැසේජ් එක: ${message.body}`);
    // Group මැසේජ් මඟ හැරීම
    if (message.from.includes('@g.us')) return;

    const text = message.body.toLowerCase().trim();
    const isFromAdmin = (message.from === '94762375808@c.us' || message.from === '274968235528230@lid'); // මැසේජ් එක එව්වේ Admin ද?

    // ----------------------------------------------------
    // 1. ADMIN COMMANDS (ඔබට පමණක් භාවිතා කළ හැකි විධානයන්)
    // ----------------------------------------------------
    if (isFromAdmin) {
        
        // අලුත් Reply එකක් දැමීම (උදා: #add price | අපේ ගාස්තුව 1000 යි)
        if (text.startsWith('#add ')) {
            const parts = message.body.substring(5).split('|');
            if (parts.length === 2) {
                saveReply(parts[0].trim(), parts[1].trim());
                await message.reply(`✅ *සාර්ථකයි!* \n\n"${parts[0].trim()}" ලෙස කවුරුහරි එවුවොත් මින්පසු reply යාවි.`);
            } else {
                await message.reply(`❌ *වැරදි ආකෘතියක්!* \nකරුණාකර මේ විදිහට එවන්න:\n#add [වචනය] | [පිළිතුර]`);
            }
            return;
        }

        // Reply එකක් මැකීම (උදා: #remove price)
        if (text.startsWith('#remove ')) {
            const keyword = message.body.substring(8).trim();
            deleteReply(keyword);
            await message.reply(`🗑️ "${keyword}" සඳහා වූ reply එක මකා දැමුවා!`);
            return;
        }

        // දැනට තියෙන ඔක්කොම Replies බැලීම (#list)
        if (text === '#list') {
            const replies = getReplies();
            let msg = '*දැනට ඇති Auto Replies ලැයිස්තුව:*\n\n';
            for (const [key, val] of Object.entries(replies)) {
                msg += `🔹 *${key}* ➡ ${val}\n`;
            }
            await message.reply(msg === '*දැනට ඇති Auto Replies ලැයිස්තුව:*\n\n' ? 'කිසිදු Reply එකක් දත්ත ගබඩාවේ නැත.' : msg);
            return;
        }
    }

    // ----------------------------------------------------
    // 2. NORMAL AUTO REPLY LOGIC (පාරිභෝගිකයින්ට යන පිළිතුරු)
    // ----------------------------------------------------
    const savedReplies = getReplies();
    if (savedReplies[text]) {
        await message.reply(savedReplies[text]);
    }
});

client.initialize();
