import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ytSearch = require('yt-search');
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is Alive!'));
app.listen(port, () => console.log(`Web server listening on port ${port}`));

// 🌟 உங்க வாட்ஸ்அப் போன் நம்பர் (மாற்றங்கள் செய்யப்பட்டுள்ளது)
const phoneNumber = "919894027502"; 

async function startBot() {
    // 🌟 FIX: பழைய லாக்ஆவுட் எர்ரர் மெமரியை உடைக்க முற்றிலும் புதிய பிரெஷ்ஷான செஷன் ஃபோல்டர்!
    const { state, saveCreds } = await useMultiFileAuthState('auth_session_fresh_v9');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        // 🌟 அஃபீஷியல் ஸ்டேபிள் டெஸ்க்டாப் ப்ரொஃபைல் பிங்கர் பிரிண்ட்
        browser: ["Ubuntu", "Chrome", "133.0.0.0"],
        syncFullHistory: false,
        markOnlineOnConnect: true
    });

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            let code = await sock.requestPairingCode(phoneNumber);
            console.log(`\n🔑 🔥 YOUR FRESH NEW PAIRING CODE: ${code} 🔥\n`);
        }, 4000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('\n🎵 Connected successfully using fresh secure session matrix!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const msg = chatUpdate.messages[0];
            if (!msg || !msg.message) return;

            const from = msg.key.remoteJid;
            const isSelf = msg.key.fromMe;
            const targetJid = isSelf ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : from;

            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

            if (text.toLowerCase().startsWith('!play')) {
                const query = text.replace(/!play/i, '').trim();
                if (!query) {
                    await sock.sendMessage(targetJid, { text: '💡 Please type like this: *!play song_name*' }, { quoted: msg });
                    return;
                }

                await sock.sendMessage(targetJid, { text: `🔍 Searching for *${query}*...` }, { quoted: msg });

                const searchResults = await ytSearch(query + " official audio");
                if (!searchResults.videos.length) {
                    await sock.sendMessage(targetJid, { text: '❌ Not found!' }, { quoted: msg });
                    return;
                }

                const video = searchResults.videos[0];
                const videoId = video.videoId;

                await sock.sendMessage(targetJid, { text: `📥 Downloading *${video.title}* via cloud api...` }, { quoted: msg });

                try {
                    const downloadUrl = "https://vkrdown.com" + videoId;
                    const outputPath = path.join(process.cwd(), `audio_${Date.now()}.mp3`);
                    const writer = fs.createWriteStream(outputPath);

                    const fileDownload = await axios({
                        url: downloadUrl,
                        method: 'GET',
                        responseType: 'stream',
                        headers: { 'User-Agent': 'Mozilla/5.0' }
                    });

                    fileDownload.data.pipe(writer);

                    writer.on('finish', async () => {
                        if (fs.existsSync(outputPath)) {
                            await sock.sendMessage(targetJid, {
                                audio: { url: outputPath },
                                mimetype: 'audio/mp4',
                                ptt: true
                            }, { quoted: msg });
                            fs.unlinkSync(outputPath);
                            console.log("✅ Sent successfully!");
                        }
                    });

                } catch (apiErr) {
                    console.error(apiErr);
                    await sock.sendMessage(targetJid, { text: `❌ Server busy. Please try again!` }, { quoted: msg });
                }
            }
        } catch (e) { console.log(e); }
    });
}
startBot();
