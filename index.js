const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const qrcode = require('qrcode'); 
const fs = require('fs');

// ==========================================
// 🔴 පද්ධති පාලන අංක (අනිවාර්යයෙන්ම වෙනස් කරන්න)
// ==========================================

// Super Admin (මෙය ඔබගේ පුද්ගලික අංකයයි - මුළු පද්ධතියම Lock කිරීමට හැකියාව ඇත)
const SUPER_ADMIN = '947XXXXXXXX@c.us'; 

// Master Admin (මෙය ඔබගේ පාරිභෝගිකයාගේ අංකයයි - ඔහුට අලුත් Bots සෑදිය හැක)
const MASTER_ADMIN = '94710401860@c.us';
const MASTER_LID = '274968235528230@lid'; 

// ==========================================
// ගොනු පිහිටුම් (File Paths)
// ==========================================
const DB_FILE = __dirname + '/database.json';
const SESSIONS_FILE = __dirname + '/sessions.json';
const LOCK_FILE = __dirname + '/system.lock';

// දත්ත ගබඩා මුලින්ම සකසා ගැනීම
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({}));
if (!fs.existsSync(SESSIONS_FILE)) fs.writeFileSync(SESSIONS_FILE, JSON.stringify(["master"]));

let clients = {}; 

// Helper Functions
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

function removeSession(name) {
    let sessions = getSessions();
    sessions = sessions.filter(s => s !== name);
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

// ==========================================
// ප්‍රධාන Bot ක්‍රියාවලිය
// ==========================================
async function createBot(sessionName, isMaster = false) {
    console.log(`[SYSTEM] ${sessionName} bot ආරම්භ කරමින් පවතී...`);
    
    let qrCount = 0;
    const MAX_QR = 3; 

    // අලුත් Browser Settings මෙහි ඇතුළත් කර ඇත
    const client = new Client({
        authStrategy: isMaster ? new LocalAuth() : new LocalAuth({ clientId: sessionName }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-extensions',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ],
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36'
        }
    });

    // --- QR Code එක හැදෙන විට ---
    client.on('qr', async (qr) => {
        qrCount++; 
        if (qrCount > MAX_QR) {
            if (clients['master'] && !isMaster) {
                await clients['master'].sendMessage(MASTER_ADMIN, `❌ *Timeout:* "${sessionName}" Bot සඳහා QR ස්කෑන් කිරීම ප්‍රමාද වූ බැවින් ක්‍රියාවලිය නතර විය.`);
            }
            client.destroy(); 
            return;
        }

        if (isMaster) {
            if (qrCount === 1) qrcodeTerminal.generate(qr, {small: true}); 
        } else {
            try {
                const qrImage = await qrcode.toDataURL(qr);
                const base64Data = qrImage.replace(/^data:image\/png;base64,/, "");
                const media = new MessageMedia('image/png', base64Data, 'qr.png');
                if (clients['master']) {
                    await clients['master'].sendMessage(MASTER_ADMIN, media, { 
                        caption: `*අලුත් QR Code එක (${qrCount}/${MAX_QR}):* ${sessionName}\n\nමිනිත්තුවක් ඇතුළත Scan කරන්න.` 
                    });
                }
            } catch (err) { console.error('QR Image Error:', err); }
        }
    });

    // --- Bot සූදානම් වූ විට ---
    client.on('ready', () => {
        console.log(`✅ [${sessionName}] සාර්ථකව සම්බන්ධ විය!`);
        if (isMaster && clients['master']) {
            clients['master'].sendMessage(MASTER_ADMIN, `✅ *WhatsApp SaaS System Online!* \n\nCommands:\n#newbot [name]\n#removebot [name]`);
        }
    });

    // --- පණිවිඩ ලැබෙන විට ---
    client.on('message_create', async (message) => {
        if (message.from.includes('@g.us')) return;

        // 1. 🔴 SUPER ADMIN KILL SWITCH
        if (message.from === SUPER_ADMIN) {
            if (message.body === '#locksystem') {
                fs.writeFileSync(LOCK_FILE, 'locked');
                await message.reply('🛑 *SYSTEM LOCKED!* \nමුළු පද්ධතියම අක්‍රිය කරන ලදී.');
                return;
            }
            if (message.body === '#unlocksystem') {
                if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
                await message.reply('✅ *SYSTEM UNLOCKED!* \nපද්ධතිය නැවත සක්‍රිය කරන ලදී.');
                return;
            }
        }

        if (fs.existsSync(LOCK_FILE)) return;

        const botNumber = client.info.wid._serialized;
        const isSelfMessage = (message.from === botNumber && message.to === botNumber);
        const isMasterAdminMessage = isMaster && (message.from === MASTER_ADMIN || message.from === MASTER_LID);

        // 2. MASTER ADMIN COMMANDS
        if (isMasterAdminMessage) {
            if (message.body.startsWith('#newbot ')) {
                const name = message.body.split(' ')[1];
                if (name) {
                    saveSession(name);
                    createBot(name, false);
                    await message.reply(`⏳ "${name}" සකසමින් පවතී...`);
                }
                return;
            }
            if (message.body.startsWith('#removebot ')) {
                const name = message.body.split(' ')[1];
                if (name && name !== 'master') {
                    removeSession(name);
                    if (clients[name]) { clients[name].destroy(); delete clients[name]; }
                    const sessionDir = __dirname + `/.wwebjs_auth/session-${name}`;
                    if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true });
                    await message.reply(`✅ "${name}" ඉවත් කරන ලදී.`);
                }
                return;
            }
        }

        // 3. USER COMMANDS
        if (isSelfMessage) {
            const text = message.body.toLowerCase().trim();
            let db = getDB();
            if (!db[botNumber]) db[botNumber] = {}; 

            if (text.startsWith('#add ')) {
                const parts = message.body.substring(5).split('|');
                if (parts.length === 2) {
                    db[botNumber][parts[0].trim().toLowerCase()] = parts[1].trim();
                    saveDB(db);
                    await message.reply(`✅ සාර්ථකයි: "${parts[0].trim()}"`);
                }
                return;
            }
            if (text.startsWith('#remove ')) {
                const keyword = message.body.substring(8).trim().toLowerCase();
                delete db[botNumber][keyword];
                saveDB(db);
                await message.reply(`🗑️ මකා දැමුවා: "${keyword}"`);
                return;
            }
            if (text === '#list') {
                let msg = '*Auto Replies:*\n';
                for (const [key, val] of Object.entries(db[botNumber])) { msg += `🔹 *${key}* ➡ ${val}\n`; }
                await message.reply(msg);
                return;
            }
        }

        // 4. AUTO REPLY LOGIC
        if (message.from !== botNumber && !isSelfMessage) {
            const text = message.body.toLowerCase().trim();
            let db = getDB();
            if (db[botNumber] && db[botNumber][text]) {
                await client.sendMessage(message.from, db[botNumber][text]);
            }
        }
    });

    client.initialize();
    clients[sessionName] = client; 
}

// පද්ධතිය ආරම්භ කිරීම
const savedSessions = getSessions();
savedSessions.forEach(session => {
    createBot(session, session === 'master');
});
