const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const qrcode = require('qrcode'); // QR Code පිංතූරයක් ලෙස සෑදීමට
const fs = require('fs');

// 🔴 ඔබගේ ප්‍රධාන අංකය (පද්ධතිය පාලනය කිරීමට)
const MASTER_ADMIN = '94762375808@c.us';
const MASTER_LID = '274968235528230@lid'; // කලින් පැමිණි විශේෂ ID එක

const DB_FILE = __dirname + '/database.json';
const SESSIONS_FILE = __dirname + '/sessions.json';

// Databases සකසා ගැනීම
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({}));
if (!fs.existsSync(SESSIONS_FILE)) fs.writeFileSync(SESSIONS_FILE, JSON.stringify(["master"]));

let clients = {}; // සියලුම bots ලාව මතක තබාගන්නා තැන

function getDB() { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
function saveDB(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }
function getSessions() { return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8')); }
function saveSession(name) {
    let sessions = getSessions();
    if (!sessions.includes(name)) {
        sessions.push(name);
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
    }
}

// Bot කෙනෙක්ව නිර්මාණය කරන ප්‍රධාන ෆන්ක්ෂන් එක
async function createBot(sessionName, isMaster = false) {
    console.log(`[SYSTEM] ${sessionName} bot ආරම්භ කරමින් පවතී...`);
    
    const client = new Client({
        authStrategy: new LocalAuth({ clientId: sessionName }),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    client.on('qr', async (qr) => {
        if (isMaster) {
            // Master bot ගේ QR එක terminal එකේ පෙන්වන්න (අවශ්‍ය නම් පමණක්)
            qrcodeTerminal.generate(qr, {small: true});
        } else {
            // අලුත් bots ලාගේ QR එක පිංතූරයක් කර Master Admin ට යවන්න
            try {
                const qrImage = await qrcode.toDataURL(qr);
                const base64Data = qrImage.replace(/^data:image\/png;base64,/, "");
                const media = new MessageMedia('image/png', base64Data, 'qr.png');
                
                if (clients['master']) {
                    await clients['master'].sendMessage(MASTER_ADMIN, media, { 
                        caption: `*අලුත් QR Code එක:* ${sessionName}\n\nමෙය ඔබගේ පාරිභෝගිකයාට යවා Scan කරගන්නා ලෙස කියන්න.` 
                    });
                }
            } catch (err) { console.error('QR Image Error:', err); }
        }
    });

    client.on('ready', () => {
        console.log(`✅ [${sessionName}] සාර්ථකව සම්බන්ධ විය!`);
        if (isMaster && clients['master']) {
            clients['master'].sendMessage(MASTER_ADMIN, `✅ *SaaS System Online!* \n\nඅලුත් Bot කෙනෙක් පද්ධතියට එකතු කරන්න මෙලෙස එවන්න:\n#newbot [නම]\n\nඋදාහරණ: #newbot nimal`);
        }
    });

    // මෙහිදී message_create භාවිතා කරන්නේ තමන් තමන්ටම යවන මැසේජ් (Message Yourself) කියවීමටයි
    client.on('message_create', async (message) => {
        if (message.from.includes('@g.us')) return; // Group මැසේජ් අත්හරින්න

        const botNumber = client.info.wid._serialized;
        
        // 1. පණිවිඩය එව්වේ තමන්ගේම 'Message Yourself' චැට් එකෙන්ද?
        const isSelfMessage = (message.from === botNumber && message.to === botNumber);
        
        // 2. පණිවිඩය එව්වේ Master Admin (ඔබ) ද?
        const isMasterAdminMessage = isMaster && (message.from === MASTER_ADMIN || message.from === MASTER_LID);

        // ==========================================
        // SaaS පද්ධතිය පාලනය කිරීමේ විධානය (ඔබට පමණයි)
        // ==========================================
        if (isMasterAdminMessage && message.body.startsWith('#newbot ')) {
            const newSessionName = message.body.split(' ')[1];
            if (newSessionName) {
                await message.reply(`⏳ "${newSessionName}" සඳහා අලුත් Bot කෙනෙක් සකසමින් පවතී... \nQR Code එක ලැබෙන තුරු රැඳී සිටින්න.`);
                saveSession(newSessionName);
                createBot(newSessionName, false);
            }
            return;
        }

        // ==========================================
        // තම තමන්ගේ Replies හදාගන්නා විධානයන් (පාරිභෝගිකයන්ට)
        // ==========================================
        if (isSelfMessage) {
            const text = message.body.toLowerCase().trim();
            let db = getDB();
            if (!db[botNumber]) db[botNumber] = {}; // අලුත් කෙනෙක් නම් දත්ත ගබඩාවේ ඉඩක් හදන්න

            if (text.startsWith('#add ')) {
                const parts = message.body.substring(5).split('|');
                if (parts.length === 2) {
                    db[botNumber][parts[0].trim().toLowerCase()] = parts[1].trim();
                    saveDB(db);
                    await message.reply(`✅ *සාර්ථකයි!* \n"${parts[0].trim()}" සඳහා පිළිතුර සකස් කෙරිණි.`);
                }
                return;
            }
            if (text.startsWith('#remove ')) {
                const keyword = message.body.substring(8).trim().toLowerCase();
                delete db[botNumber][keyword];
                saveDB(db);
                await message.reply(`🗑️ "${keyword}" මකා දැමුවා!`);
                return;
            }
            if (text === '#list') {
                let msg = '*ඔබේ Auto Replies ලැයිස්තුව:*\n\n';
                for (const [key, val] of Object.entries(db[botNumber])) {
                    msg += `🔹 *${key}* ➡ ${val}\n`;
                }
                await message.reply(msg === '*ඔබේ Auto Replies ලැයිස්තුව:*\n\n' ? 'කිසිදු Reply එකක් තවම එකතු කර නැත.' : msg);
                return;
            }
        }

        // ==========================================
        // සාමාන්‍ය පාරිභෝගිකයන්ට Auto-Reply යාම
        // ==========================================
        // මෙය ක්‍රියාත්මක වන්නේ වෙනත් අයෙකුගෙන් එන මැසේජ් වලට පමණි
        if (message.from !== botNumber) {
            const text = message.body.toLowerCase().trim();
            let db = getDB();
            if (db[botNumber] && db[botNumber][text]) {
                await client.sendMessage(message.from, db[botNumber][text]);
            }
        }
    });

    client.initialize();
    clients[sessionName] = client; // මතකයෙහි ගබඩා කරගැනීම
}

// පද්ධතිය ආරම්භයේදී කලින් සාදා ඇති සියලුම bots ලාව එකවර start කිරීම
const savedSessions = getSessions();
savedSessions.forEach(session => {
    createBot(session, session === 'master');
});
