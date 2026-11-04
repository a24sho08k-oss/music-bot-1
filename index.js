import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import readline from 'readline';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ytSearch = require('yt-search');

// Terminal-ல இருந்து போன் நம்பர் இன்புட் வாங்க readline செட்டப்
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // QR code தேவையில்லை
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.0"] // Pairing code வேலை செய்ய இது முக்கியம்
    });

    // 🌟 போன் நம்பரை ரன் டைமில் கேட்டு வாங்கி, Pairing Code உருவாக்கும் பகுதி
    if (!sock.authState.creds.registered) {
        let phoneNumber = await question('\n📱 Enter your WhatsApp Phone Number (with Country Code, e.g., 919876543210): ');
        phoneNumber = phoneNumber.replace(/[^0-9]/g, ''); // எண்களை மட்டும் ஃபில்டர் செய்கிறது

        if (!phoneNumber) {
            console.log('❌ Invalid phone number. Please restart the script!');
            process.exit(0);
        }

        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                console.log(`\n🔑 🔥 YOUR WA BOT PAIRING CODE: ${code} 🔥\n`);
            } catch (err) {
                console.error("❌ Pairing code creation failed. Try again!", err);
            }
        }, 3000); // 3 செகண்ட்ஸ் வெயிட் பண்ணி கோடு ஜெனரேட் ஆகும்
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('\n🎵 Real Voice Note Bot is Successfully Connected!');
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

                await sock.sendMessage(from, { text: `🔍 Processing request... Please wait.` }, { quoted: msg });

                let videoUrl = query;
                let postCaption = '';
                let thumbnail = '';

                if (query.includes('youtube.com') || query.includes('youtu.be')) {
                    videoUrl = query;
                    postCaption = `🎵 *YOUTUBE LINK DETECTED* 🎵\n\n📥 _Downloading audio now, please wait..._`;
                } else {
                    const searchResults = await ytSearch(query);
                    if (!searchResults || !searchResults.videos || searchResults.videos.length === 0) {
                        await sock.sendMessage(from, { text: '❌ Song not found on YouTube!' }, { quoted: msg });
                        return;
                    }
                    const video = searchResults.videos[0];
                    videoUrl = video.url;
                    thumbnail = video.thumbnail;
                    postCaption = `🎵 *SONG DETAILS* 🎵\n\n📌 *Title:* ${video.title}\n\n📥 _Downloading audio now, please wait..._`;
                }

                if (thumbnail) {
                    await sock.sendMessage(from, { image: { url: thumbnail }, caption: postCaption }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, { text: postCaption }, { quoted: msg });
                }

                const outputFilename = `audio_${Date.now()}.opus`;
                const outputPath = path.join(process.cwd(), outputFilename);

                // லோக்கல் டெர்மினல் கமாண்ட் (Termux-க்கு ஏற்றது)
                const cmd = `yt-dlp --extract-audio --audio-format opus --no-playlist --output "${outputPath}" "${videoUrl}"`;

                exec(cmd, async (error) => {
                    if (error) {
                        console.error("Download error:", error);
                        return;
                    }

                    if (fs.existsSync(outputPath)) {
                        await sock.sendMessage(from, {
                            audio: { url: outputPath },
                            mimetype: 'audio/ogg; codecs=opus',
                            ptt: true
                        }, { quoted: msg });

                        fs.unlinkSync(outputPath);
                        console.log('✅ Voice note sent successfully!');
                    }
                });
            }
        } catch (e) {
            console.log(e);
        }
    });
}

startBot();
