const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const qrcode = require('qrcode'); 
const fs = require('fs');

// 🔴 Master Admin Configurations
const MASTER_ADMIN = '94710401860@c.us';
const MASTER_LID = '274968235528230@lid'; 

const DB_FILE = __dirname + '/database.json';
const SESSIONS_FILE = __dirname + '/sessions.json';

// Initialize Databases
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({}));
if (!fs.existsSync(SESSIONS_FILE)) fs.writeFileSync(SESSIONS_FILE, JSON.stringify(["master"]));

let clients = {}; // Store running bot instances

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
    const MAX_QR = 3; 

    const client = new Client({
        // Separate auth folders for Master and sub-bots
        authStrategy: isMaster ? new LocalAuth() : new LocalAuth({ clientId: sessionName }),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    client.on('qr', async (qr) => {
        qrCount++; 
        
        // Stop bot if QR times out
        if (qrCount > MAX_QR) {
            console.log(`[SYSTEM] QR scan timeout for ${sessionName}. Stopping bot.`);
            if (clients['master'] && !isMaster) {
                await clients['master'].sendMessage(MASTER_ADMIN, `❌ *Timeout:* QR scan delayed for "${sessionName}". Process stopped. \nSend *#newbot ${sessionName}* to try again.`);
            }
            client.destroy(); 
            return;
        }

        if (isMaster) {
            // Show Master QR in terminal only
            if (qrCount === 1) qrcodeTerminal.generate(qr, {small: true}); 
        } else {
            // Send new bot QR as an image to Master Admin
            try {
                const qrImage = await qrcode.toDataURL(qr);
                const base64Data = qrImage.replace(/^data:image\/png;base64,/, "");
                const media = new MessageMedia('image/png', base64Data, 'qr.png');
                
                if (clients['master']) {
                    await clients['master'].sendMessage(MASTER_ADMIN, media, { 
                        caption: `*New QR Code (${qrCount}/${MAX_QR}):* ${sessionName}\n\nExpires in 20 seconds. Scan immediately.` 
                    });
                }
            } catch (err) { console.error('QR Image Error:', err); }
        }
    });

    client.on('ready', () => {
        console.log(`✅ [${sessionName}] Successfully connected!`);
        if (isMaster && clients['master']) {
            clients['master'].sendMessage(MASTER_ADMIN, `✅ *SaaS System Online!* \n\nTo add a new bot:\n#newbot [name]\n\nTo remove a bot:\n#removebot [name]`);
        }
    });

    client.on('message_create', async (message) => {
        if (message.from.includes('@g.us')) return; // Ignore group messages

        const botNumber = client.info.wid._serialized;
        
        // Check if message is a "Message Yourself" self-message
        const isSelfMessage = (message.from === botNumber && message.to === botNumber);
        
        // Check if message is from Master Admin
        const isMasterAdminMessage = isMaster && (message.from === MASTER_ADMIN || message.from === MASTER_LID);

        // ==========================================
        // 1. SaaS Master Admin Commands
        // ==========================================
        if (isMasterAdminMessage) {
            
            // Add a new Bot
            if (message.body.startsWith('#newbot ')) {
                const newSessionName = message.body.split(' ')[1];
                if (newSessionName) {
                    await message.reply(`⏳ Setting up new bot "${newSessionName}"... \nPlease wait for the QR code.`);
                    saveSession(newSessionName);
                    createBot(newSessionName, false);
                }
                return;
            }

            // Remove an existing Bot
            if (message.body.startsWith('#removebot ')) {
                const targetSession = message.body.split(' ')[1];
                if (targetSession) {
                    if (targetSession === 'master') {
                        await message.reply('❌ Cannot delete the Master Bot!');
                        return;
                    }

                    await message.reply(`⏳ Removing "${targetSession}" from the system...`);

                    removeSession(targetSession); // Remove from DB

                    if (clients[targetSession]) {
                        clients[targetSession].destroy(); // Stop bot process
                        delete clients[targetSession];
                    }

                    // Delete session folder to free storage
                    const sessionDir = __dirname + `/.wwebjs_auth/session-${targetSession}`;
                    if (fs.existsSync(sessionDir)) {
                        fs.rmSync(sessionDir, { recursive: true, force: true });
                    }

                    await message.reply(`✅ Bot "${targetSession}" completely removed from the system.`);
                }
                return;
            }
        }

        // ==========================================
        // 2. User Commands (Manage Auto-Replies)
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
                    await message.reply(`✅ *Success!* \nAuto-reply set for "${parts[0].trim()}".`);
                }
                return;
            }
            if (text.startsWith('#remove ')) {
                const keyword = message.body.substring(8).trim().toLowerCase();
                delete db[botNumber][keyword];
                saveDB(db);
                await message.reply(`🗑️ Removed reply for "${keyword}"!`);
                return;
            }
            if (text === '#list') {
                let msg = '*Your Auto-Replies List:*\n\n';
                for (const [key, val] of Object.entries(db[botNumber])) {
                    msg += `🔹 *${key}* ➡ ${val}\n`;
                }
                await message.reply(msg === '*Your Auto-Replies List:*\n\n' ? 'No auto-replies added yet.' : msg);
                return;
            }
        }

        // ==========================================
        // 3. Auto-Reply to Regular Customers
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

// Start all previously saved bots on system boot
const savedSessions = getSessions();
savedSessions.forEach(session => {
    createBot(session, session === 'master');
});
