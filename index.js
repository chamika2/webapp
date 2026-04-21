const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const qrcode = require('qrcode'); 
const fs = require('fs');

const DB_FILE = __dirname + '/database.json';
const SESSIONS_FILE = __dirname + '/sessions.json';
const CONFIG_FILE = __dirname + '/config.json'; // Admin ගේ අංකය සේව් වන අලුත් ගොනුව

// දත්ත ගබඩා මුලින්ම සකසා ගැනීම
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({}));
if (!fs.existsSync(SESSIONS_FILE)) fs.writeFileSync(SESSIONS_FILE, JSON.stringify(["master"]));

// මුල්ම Owner ගේ අංකය (ඔබේ අංකය) මෙහි සකසා ඇත. පසුව මෙය WhatsApp හරහා වෙනස් කළ හැක.
if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ master_admin: "94716204364@c.us" }, null, 2));
}

let clients = {}; 

// Helper Functions
function getDB() { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
function saveDB(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }
function getSessions() { return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8')); }
function getConfig() { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
function setConfig(key, value) {
    let config = getConfig();
    config[key] = value;
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

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

// ප්‍රධාන Bot ක්‍රියාවලිය
async function createBot(sessionName, isMaster = false) {
    console.log(`[SYSTEM] Starting bot: ${sessionName}...`);
    
    let qrCount = 0; 
    const MAX_QR = 3; 

    const client = new Client({
        authStrategy: isMaster ? new LocalAuth() : new LocalAuth({ clientId: sessionName }),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-extensions', '--disable-dev-shm-usage']
        },
        // 🔴 Try Again Error එක සෑදීම වැළැක්වීමේ විශේෂ කේතය (WhatsApp Update Bypass)
        webVersionCache: {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
        }
    });

    client.on('qr', async (qr) => {
        qrCount++; 
        let config = getConfig();
        const CURRENT_MASTER = config.master_admin;

        if (qrCount > MAX_QR) {
            console.log(`[SYSTEM] QR scan timeout for ${sessionName}.`);
            if (clients['master'] && !isMaster) {
                await clients['master'].sendMessage(CURRENT_MASTER, `❌ *Timeout:* "${sessionName}" සඳහා QR ස්කෑන් කිරීම ප්‍රමාද විය. \nනැවත අවශ්‍ය නම් *#newbot ${sessionName}* ලෙස එවන්න.`);
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
                    await clients['master'].sendMessage(CURRENT_MASTER, media, { 
                        caption: `*අලුත් QR Code එක (${qrCount}/${MAX_QR}):* ${sessionName}\n\nතත්පර 20කින් Expire වේ. වහාම Scan කරන්න.` 
                    });
                }
            } catch (err) { console.error('QR Image Error:', err); }
        }
    });

    client.on('ready', () => {
        console.log(`✅ [${sessionName}] Successfully connected!`);
        let config = getConfig();
        if (isMaster && clients['master']) {
            clients['master'].sendMessage(config.master_admin, `✅ *SaaS System Online!*\n\n🔹 අලුත් Bot කෙනෙක් හදන්න:\n#newbot [name]\n\n🔹 Bot කෙනෙක් මකන්න:\n#removebot [name]\n\n👑 *Owner අයිතිය වෙනත් අංකයකට මාරු කරන්න:*\n#setowner 947XXXXXXXX`);
        }
    });

    client.on('message_create', async (message) => {
        if (message.from.includes('@g.us')) return; 

        const botNumber = client.info.wid._serialized;
        const isSelfMessage = (message.from === botNumber && message.to === botNumber);
        
        let config = getConfig();
        const CURRENT_MASTER = config.master_admin;
        const isMasterAdminMessage = isMaster && (message.from === CURRENT_MASTER || message.from === '274968235528230@lid');

        // ==========================================
        // 1. Master Admin Commands (ඔබට හෝ අලුත් Owner ට)
        // ==========================================
        if (isMasterAdminMessage) {
            
            // 🔴 අලුත් පහසුකම: Owner අයිතිය මාරු කිරීම
            if (message.body.startsWith('#setowner ')) {
                let newOwner = message.body.split(' ')[1];
                if (newOwner) {
                    // අංකයට @c.us නැත්නම් එය ස්වයංක්‍රීයව එකතු කිරීම
                    if (!newOwner.includes('@c.us')) newOwner = newOwner + '@c.us';
                    
                    setConfig('master_admin', newOwner);
                    await message.reply(`✅ *සාර්ථකයි!* \nපද්ධතියේ සම්පූර්ණ අයිතිය (Owner) ${newOwner} වෙත මාරු කරන ලදී. මින්පසු ඔබට මෙම පද්ධතිය පාලනය කළ නොහැක.`);
                    
                    // අලුත් Owner ට පණිවිඩයක් යැවීම
                    try {
                        await clients['master'].sendMessage(newOwner, `👑 *ඔබට පද්ධතියේ ප්‍රධාන අයිතිය (Master Admin) ලැබී ඇත!*\n\nCommands:\n#newbot [name]\n#removebot [name]\n#setowner [number]`);
                    } catch(e) {}
                }
                return;
            }

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
                    await message.reply(`⏳ Removing "${targetSession}"...`);
                    removeSession(targetSession); 
                    if (clients[targetSession]) {
                        clients[targetSession].destroy(); 
                        delete clients[targetSession];
                    }
                    const sessionDir = __dirname + `/.wwebjs_auth/session-${targetSession}`;
                    if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true });
                    await message.reply(`✅ Bot "${targetSession}" ඉවත් කරන ලදී.`);
                }
                return;
            }
        }

        // ==========================================
        // 2. User Commands (තමන්ගේ Replies සකසා ගැනීමට)
        // ==========================================
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
                let msg = '*Auto-Replies:*\n\n';
                for (const [key, val] of Object.entries(db[botNumber])) { msg += `🔹 *${key}* ➡ ${val}\n`; }
                await message.reply(msg === '*Auto-Replies:*\n\n' ? 'No replies added.' : msg);
                return;
            }
        }

        // ==========================================
        // 3. Auto-Reply (සාමාන්‍ය මැසේජ් සඳහා)
        // ==========================================
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

const savedSessions = getSessions();
savedSessions.forEach(session => {
    createBot(session, session === 'master');
});
