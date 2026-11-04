import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ytSearch = require('yt-search');
const express = require('express');
const ytdl = require('@distube/ytdl-core');

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
                const outputPath = path.join(process.cwd(), `audio_${Date.now()}.mp3`);

                console.log(`🎬 Downloading via native stream: ${video.title}`);
                await sock.sendMessage(from, { text: `📥 Downloading *${video.title}* ...` }, { quoted: msg });

                // 🌟 FIX: எந்த வெப்சைட்டும் இல்லாம நேரடியா ஆடியோ ஸ்ட்ரீம் டவுன்லோட் பண்றோம்
                const stream = ytdl(video.url, {
                    filter: 'audioonly',
                    quality: 'highestaudio',
                    requestOptions: {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                        }
                    }
                });

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
                        console.log("✅ Sent successfully!");
                    }
                });

                stream.on('error', async (err) => {
                    console.error("Stream error:", err);
                    await sock.sendMessage(from, { text: `❌ Download Glitch: ${err.message}` }, { quoted: msg });
                });
            }
        } catch (e) { console.log(e); }
    });
}
startBot();
