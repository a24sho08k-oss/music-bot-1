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

// 🌟 Unga targetted secondary WhatsApp profile number
const phoneNumber = "919894027502"; 

async function startBot() {
    // 🌟 Absolute fresh initialization structure setup
    const { state, saveCreds } = await useMultiFileAuthState('auth_session_yt_stable_v1');

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
            console.log('\n🎵 Secure Dynamic Node Bot is successfully connected!');
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

                await sock.sendMessage(targetJid, { text: `🔍 Searching for *${query}* via yt data engine...` }, { quoted: msg });

                const searchResults = await ytSearch(query + " official audio");
                if (!searchResults.videos.length) {
                    await sock.sendMessage(targetJid, { text: '❌ Audio query structural mismatch!' }, { quoted: msg });
                    return;
                }

                const video = searchResults.videos[0];
                const outputPath = path.join(process.cwd(), `audio_${Date.now()}.mp3`);

                await sock.sendMessage(targetJid, { text: `📥 Fetching and extracting audio matrix for *${video.title}*...` }, { quoted: msg });

                // 🌟 FIX: Online APIs use pannama, server kula run aagura local yt-dlp layer bypass
                const cmd = `npx -y yt-dlp --extract-audio --audio-format mp3 --no-playlist --no-cache-dir --geo-bypass --output "${outputPath}" "${video.url}"`;

                console.log(`🎬 Dynamic Local Processing trigger for URL: ${video.url}`);

                exec(cmd, async (error, stdout, stderr) => {
                    if (error) {
                        console.error("Internal Engine Error:", error);
                        // Security parameters context tracking fallback method integration
                        const fallbackUrl = `https://vkrdown.com{video.url}`;
                        await sock.sendMessage(targetJid, { audio: { url: fallbackUrl }, mimetype: 'audio/mp4', ptt: true }, { quoted: msg });
                        return;
                    }

                    if (fs.existsSync(outputPath)) {
                        await sock.sendMessage(targetJid, {
                            audio: { url: outputPath },
                            mimetype: 'audio/mp4',
                            ptt: true
                        }, { quoted: msg });
                        fs.unlinkSync(outputPath);
                        console.log("✅ File streamed out perfectly from Local Machine container!");
                    } else {
                        const fallbackUrl = `https://vkrdown.com{video.url}`;
                        await sock.sendMessage(targetJid, { audio: { url: fallbackUrl }, mimetype: 'audio/mp4', ptt: true }, { quoted: msg });
                    }
                });
            }
        } catch (e) { console.log(e); }
    });
}
startBot();
