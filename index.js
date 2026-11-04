import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const SoundCloud = require('soundcloud-scraper');
const client = new SoundCloud.Client();
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is Alive!'));
app.listen(port, () => console.log(`Web server listening on port ${port}`));

// 🌟 Unga WA Phone number
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
            console.log('\n🎵 SoundCloud Audio Bot Connected Successfully!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const msg = chatUpdate.messages[0];
            if (!msg || !msg.message) return;

            const from = msg.key.remoteJid;
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

            if (text.toLowerCase().startsWith('!play')) {
                const query = text.replace(/!play/i, '').trim();
                if (!query) {
                    await sock.sendMessage(from, { text: '💡 Please type like this: *!play song_name*' }, { quoted: msg });
                    return;
                }

                await sock.sendMessage(from, { text: `🔍 Searching on SoundCloud for *${query}*...` }, { quoted: msg });

                // 🌟 YouTube-ai bypass panni SoundCloud platform search panrom
                const searchResults = await client.search(query, 'track');
                if (!searchResults || searchResults.length === 0) {
                    await sock.sendMessage(from, { text: '❌ Audio track not found on cloud networks!' }, { quoted: msg });
                    return;
                }

                const track = searchResults[0];
                await sock.sendMessage(from, { text: `📥 Streaming audio: *${track.title}* via SoundCloud server...` }, { quoted: msg });

                const outputPath = path.join(process.cwd(), `audio_${Date.now()}.mp3`);
                
                const stream = await track.downloadProgressive();
                const fileStream = fs.createWriteStream(outputPath);
                
                stream.pipe(fileStream);

                fileStream.on('finish', async () => {
                    if (fs.existsSync(outputPath)) {
                        await sock.sendMessage(from, {
                            audio: { url: outputPath },
                            mimetype: 'audio/mp4',
                            ptt: true
                        }, { quoted: msg });
                        fs.unlinkSync(outputPath);
                        console.log("✅ SoundCloud track pushed to WA chat!");
                    }
                });

                stream.on('error', async (err) => {
                    console.error("Cloud stream error:", err);
                    await sock.sendMessage(from, { text: `❌ Stream error: ${err.message}` }, { quoted: msg });
                });
            }
        } catch (e) { console.log(e); }
    });
}
startBot();
