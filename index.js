const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const qrcode = require('qrcode'); 
const fs = require('fs');

// 🔴 Master Admin Configurations
const MASTER_ADMIN = '94710401860@c.us';
const MASTER_LID = ' @lid'; 

const DB_FILE = __dirname + '/database.json';
const SESSIONS_FILE = __dirname + '/sessions.json';

// Initialize Databases
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({}));
if (!fs.existsSync(SESSIONS_FILE)) fs.writeFileSync(SESSIONS_FILE, JSON.stringify(["master"]));

let clients = {}; 

// Database Helper Functions
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

// Main Function to Create a Bot
async function createBot(sessionName, isMaster = false) {
    console.log(`[SYSTEM] Starting bot: ${sessionName}...`);
    
    let qrCount = 0; 
    const MAX_QR = 5; // QR එක වාර 5ක් දක්වා උත්සාහ කිරීමට ඉඩ ලබා දී ඇත

    const client = new Client({
        authStrategy: isMaster ? new LocalAuth() : new LocalAuth({ clientId: sessionName }),
        // 🔴 Linking Error එක විසඳීමට අවශ්‍ය සැකසුම් පහතින්
        webVersionCache: {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
        },
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ],
            // සාමාන්‍ය පරිගණකයක පෙනුම ලබා දීමට (User Agent)
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    client.on('qr', async (qr) => {
        qrCount++; 
        if (qrCount > MAX_QR) {
            console.log(`[SYSTEM] QR scan timeout for ${sessionName}.`);
            if (clients['master'] && !isMaster) {
                await clients['master'].sendMessage(MASTER_ADMIN, `❌ *Timeout:* QR ස්කෑන් කිරීම ප්‍රමාද වැඩියි. "${sessionName}" නවතා දැමුණි.`);
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
                        caption: `*New QR Code (${qrCount}/${MAX_QR}):* ${sessionName}\n\nකරුණාකර තත්පර 30ක් ඇතුළත ස්කෑන් කරන්න.` 
                    });
                }
            } catch (err) { console.error('QR Image Error:', err); }
        }
    });

    client.on('ready', () => {
        console.log(`✅ [${sessionName}] Successfully connected!`);
        if (isMaster && clients['master']) {
            clients['master'].sendMessage(MASTER_ADMIN, `✅ *SaaS System Online!*\n\n🔹 අලුත් Bot කෙනෙක් එකතු කිරීමට:\n#newbot [name]\n\n🔹 Bot කෙනෙක් ඉවත් කිරීමට:\n#removebot [name]`);
        }
    });

    client.on('message_create', async (message) => {
        if (message.from.includes('@g.us')) return; 

        const botNumber = client.info.wid._serialized;
        const isSelfMessage = (message.from === botNumber && message.to === botNumber);
        const isMasterAdminMessage = isMaster && (message.from === MASTER_ADMIN || message.from === MASTER_LID);

        // --- SaaS Master Admin Commands ---
        if (isMasterAdminMessage) {
            if (message.body.startsWith('#newbot ')) {
                const newSessionName = message.body.split(' ')[1];
                if (newSessionName) {
                    await message.reply(`⏳ "${newSessionName}" සඳහා අලුත් Bot කෙනෙක් සකසමින් පවතී...`);
                    saveSession(newSessionName);
                    createBot(newSessionName, false);
                }
                return;
            }

            if (message.body.startsWith('#removebot ')) {
                const targetSession = message.body.split(' ')[1];
                if (targetSession) {
                    if (targetSession === 'master') {
                        await message.reply('❌ Master Bot එක මකා දැමිය නොහැක!');
                        return;
                    }
                    removeSession(targetSession); 
                    if (clients[targetSession]) {
                        clients[targetSession].destroy(); 
                        delete clients[targetSession];
                    }
                    const sessionDir = __dirname + `/.wwebjs_auth/session-${targetSession}`;
                    if (fs.existsSync(sessionDir)) {
                        fs.rmSync(sessionDir, { recursive: true, force: true });
                    }
                    await message.reply(`✅ Bot "${targetSession}" ඉවත් කරන ලදී.`);
                }
                return;
            }
        }

        // --- User Commands (Manage Auto-Replies) ---
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
                let msg = '*Auto-Replies:* \n\n';
                for (const [key, val] of Object.entries(db[botNumber])) {
                    msg += `🔹 *${key}* ➡ ${val}\n`;
                }
                await message.reply(msg === '*Auto-Replies:* \n\n' ? 'තවම කිසිවක් එක් කර නැත.' : msg);
                return;
            }
        }

        // --- Auto-Reply Logic ---
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

// Start all bots
const savedSessions = getSessions();
savedSessions.forEach(session => {
    createBot(session, session === 'master');
});
