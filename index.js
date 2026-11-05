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
const port = process.env.PORT || 8080;
app.get('/', (req, res) => res.send('Bot is Alive!'));
app.listen(port, "0.0.0.0", () => console.log(`Web server listening on port ${port}`));

const phoneNumber = "919894027502"; 

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_session_snap_v1');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
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
            console.log('\n🎵 Secure Dynamic Node Bot Connected!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const msg = chatUpdate.messages[0];
            if (!msg || !msg.message) return;

            const from = msg.key.remoteJid;
            
            // 🌟 FIX: சொந்த நம்பர் சாட்டாக இருந்தால், மெசேஜை அதே ஓன் சாட்டிற்கு திருப்பி அனுப்பும் லாஜிக்
            const isSelf = msg.key.fromMe;
            const targetJid = isSelf ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : from;

            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

            if (text.toLowerCase().startsWith('!play')) {
                const query = text.replace(/!play/i, '').trim();
                if (!query) {
                    await sock.sendMessage(targetJid, { text: '💡 Please type like this: *!play song_name*' }, { quoted: msg });
                    return;
                }

                await sock.sendMessage(targetJid, { text: `🔍 Searching for *${query}* via yt data engine...` }, { quoted: msg });

                const searchResults = await ytSearch(query + " official audio");
                if (!searchResults.videos.length) {
                    await sock.sendMessage(targetJid, { text: '❌ Audio query error!' }, { quoted: msg });
                    return;
                }

                const video = searchResults.videos[0];
                const outputPath = path.join(process.cwd(), `audio_${Date.now()}.mp3`);

                await sock.sendMessage(targetJid, { text: `📥 Fetching audio for *${video.title}*...` }, { quoted: msg });

                const cmd = `npx -y yt-dlp --extract-audio --audio-format mp3 --no-playlist --no-cache-dir --geo-bypass --output "${outputPath}" "${video.url}"`;

                exec(cmd, async (error) => {
                    if (error) {
                        console.error(error);
                        return;
                    }

                    if (fs.existsSync(outputPath)) {
                        await sock.sendMessage(targetJid, {
                            audio: { url: outputPath },
                            mimetype: 'audio/mp4',
                            ptt: true
                        }, { quoted: msg });
                        fs.unlinkSync(outputPath);
                    }
                });
            }
        } catch (e) { console.log(e); }
    });
}
startBot();
