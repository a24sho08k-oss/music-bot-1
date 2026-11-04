import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ytSearch = require('yt-search');
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is Alive!'));
app.listen(port, () => console.log(`Web server listening on port ${port}`));

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

                await sock.sendMessage(from, { text: `🔍 Searching for *${query}*...` }, { quoted: msg });

                const searchResults = await ytSearch(query + " official audio");
                if (!searchResults.videos.length) {
                    await sock.sendMessage(from, { text: '❌ Not found!' }, { quoted: msg });
                    return;
                }

                const video = searchResults.videos[0];
                const outputPath = path.join(process.cwd(), `audio_${Date.now()}.opus`);
                
                // 🌟 FIX: 429/403 மற்றும் JS Runtime பிளாக்கை உடைக்கும் புதிய பக்கா கமாண்ட்
                const cmd = `yt-dlp --extract-audio --audio-format opus --no-playlist --system-javascript --no-cache-dir --geo-bypass --output "${outputPath}" "${video.url}"`;

                console.log(`🎬 Triggering yt-dlp for: ${video.title}`);

                exec(cmd, async (error, stdout, stderr) => {
                    if (error) {
                        console.error("❌ Download Fail Error:", error);
                        await sock.sendMessage(from, { text: `❌ Download Failed!\n\n*Error:* ${error.message}\n\n*Stderr:* ${stderr}` }, { quoted: msg });
                        return;
                    }

                    if (fs.existsSync(outputPath)) {
                        await sock.sendMessage(from, {
                            audio: { url: outputPath },
                            mimetype: 'audio/ogg; codecs=opus',
                            ptt: true
                        }, { quoted: msg });
                        fs.unlinkSync(outputPath);
                        console.log("✅ Audio voice note sent!");
                    } else {
                        await sock.sendMessage(from, { text: `❌ File error.` }, { quoted: msg });
                    }
                });
            }
        } catch (e) { console.log(e); }
    });
}
startBot();
