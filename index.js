import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is Alive!'));
app.listen(port, () => console.log(`Web server listening on port ${port}`));

// 🌟 உங்க வாட்ஸ்அப் போன் நம்பர்
const phoneNumber = "919894027502"; 

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ["Mac OS", "Chrome", "120.0.0.0"],
        syncFullHistory: false
    });

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            let code = await sock.requestPairingCode(phoneNumber);
            console.log(`\n🔑 🔥 YOUR WA BOT PAIRING CODE: ${code} 🔥\n`);
        }, 3000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('\n🎵 Secure API Audio Bot is Live!');
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

                await sock.sendMessage(targetJid, { text: `🔍 Searching for *${query}* via open music network...` }, { quoted: msg });

                try {
                    // 🌟 FIX: அஃபீஷியல் ஜாமெண்டோ ஃப்ரீ API வித் கிளைன்ட் ஐடி சின்டாக்ஸ் பக்கா-வா செட் பண்ணியாச்சு!
                    const targetUrl = "https://jamendo.com" + encodeURIComponent(query);
                    const searchRes = await axios.get(targetUrl);
                    
                    if (!searchRes.data.results || searchRes.data.results.length === 0) {
                        await sock.sendMessage(targetJid, { text: '❌ Track not found on open servers!' }, { quoted: msg });
                        return;
                    }

                    const track = searchRes.data.results[0];
                    await sock.sendMessage(targetJid, { text: `📥 Streaming: *${track.name}* by *${track.artist_name}*...` }, { quoted: msg });

                    const outputPath = path.join(process.cwd(), `audio_${Date.now()}.mp3`);
                    
                    const fileDownload = await axios({
                        url: track.audio,
                        method: 'GET',
                        responseType: 'stream'
                    });

                    const writer = fs.createWriteStream(outputPath);
                    fileDownload.data.pipe(writer);

                    writer.on('finish', async () => {
                        if (fs.existsSync(outputPath)) {
                            await sock.sendMessage(targetJid, {
                                audio: { url: outputPath },
                                mimetype: 'audio/mp4',
                                ptt: true
                            }, { quoted: msg });
                            fs.unlinkSync(outputPath);
                            console.log("✅ Sent successfully via Jamendo API!");
                        }
                    });

                } catch (err) {
                    console.error(err);
                    await sock.sendMessage(targetJid, { text: `❌ Network busy or server issue. Please try again!` }, { quoted: msg });
                }
            }
        } catch (e) { console.log(e); }
    });
}
startBot();
