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

// 🌟 உங்க வாட்ஸ்அப் போன் நம்பரை இங்கே போடுங்க (நாட்டுக் குறியீடுடன் - எ.கா: 919876543210)
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
            console.log('\n🎵 Bot is Successfully Connected to WhatsApp!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const msg = chatUpdate.messages;
            if (!msg || !msg.message) return;

            const from = msg.key.remoteJid;
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

            if (text.toLowerCase().startsWith('!play')) {
                const query = text.replace(/!play/i, '').trim();
                if (!query) {
                    await sock.sendMessage(from, { text: '💡 Please type like this: *!play song_name*' }, { quoted: msg });
                    return;
                }

                await sock.sendMessage(from, { text: `🔍 Searching for *${query}*...` }, { quoted: msg });

                const searchResults = await ytSearch(query + " official audio");
                if (!searchResults.videos.length) {
                    await sock.sendMessage(from, { text: '❌ Not found!' }, { quoted: msg });
                    return;
                }

                const video = searchResults.videos;
                const videoId = video.videoId;

                console.log(`🎬 Fetching API download link for ID: ${videoId}`);

                try {
                    // 🌟 FIX: சாய்வுக்கோடுடன் கூடிய துல்லியமான அஃபீஷியல் ஸ்ட்ரீமிங் எண்ட்பாயிண்ட்!
                    const downloadUrl = "https://vevioz.com".concat(videoId);
                    
                    await sock.sendMessage(from, { text: `📥 Downloading *${video.title}* via secure cloud api...` }, { quoted: msg });

                    const outputPath = path.join(process.cwd(), `audio_${Date.now()}.mp3`);
                    const writer = fs.createWriteStream(outputPath);

                    const fileDownload = await axios({
                        url: downloadUrl,
                        method: 'GET',
                        responseType: 'stream'
                    });

                    fileDownload.data.pipe(writer);

                    writer.on('finish', async () => {
                        if (fs.existsSync(outputPath)) {
                            await sock.sendMessage(from, {
                                audio: { url: outputPath },
                                mimetype: 'audio/mp4',
                                ptt: true
                            }, { quoted: msg });
                            fs.unlinkSync(outputPath);
                            console.log("✅ Audio voice note sent successfully!");
                        }
                    });

                    writer.on('error', async (err) => {
                        console.error("Writer error:", err);
                        await sock.sendMessage(from, { text: `❌ File Save Error: ${err.message}` }, { quoted: msg });
                    });

                } catch (apiErr) {
                    console.error("API Error:", apiErr);
                    await sock.sendMessage(from, { text: `❌ API Request Failed! Please try again.` }, { quoted: msg });
                }
            }
        } catch (e) { console.log(e); }
    });
}
startBot();
