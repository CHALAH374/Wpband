const { makeid } = require('./gen-id');
const express = require('express');
const fs = require('fs');
let router = express.Router();
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    Browsers,
    makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

// Random delay generator
function randomDelay(minMs, maxMs) {
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

// --- Safe bulk sender ---
async function sendMessagesSafely(sock, jid, total, batchSize, msgFactory, opts = {}) {
    const {
        minMsgDelayMs = 2000,
        maxMsgDelayMs = 6000,
        minBatchPauseMs = 60 * 1000,    // 1 min pause between batches
        maxBatchPauseMs = 3 * 60 * 1000, // up to 3 min
        stopOnError = true
    } = opts;

    let sent = 0;
    for (let i = 0; i < total; i += batchSize) {
        const batchEnd = Math.min(i + batchSize, total);
        console.log(`🔁 Starting batch ${i + 1} to ${batchEnd}`);

        for (let j = i; j < batchEnd; j++) {
            try {
                const payload = msgFactory(j);
                await delay(randomDelay(minMsgDelayMs, maxMsgDelayMs));
                const res = await sock.sendMessage(jid, payload);
                sent++;
                console.log(`✅ Sent ${sent}/${total} (index ${j})`);
            } catch (err) {
                console.error(`❌ Error at index ${j}:`, err?.message || err);
                if (stopOnError) {
                    console.warn('⛔ Stopping bulk send due to error.');
                    return { sent, stopped: true };
                }
            }
        }

        if (sent >= total) break;

        const pauseMs = randomDelay(minBatchPauseMs, maxBatchPauseMs);
        console.log(`⏸ Pausing ${Math.round(pauseMs / 1000)}s before next batch...`);
        await delay(pauseMs);
    }

    return { sent, stopped: false };
}

router.get('/', async (req, res) => {
    const id = makeid();
    let num = req.query.number;

    async function GIFTED_MD_PAIR_CODE() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);
        try {
            var items = ["Safari"];
            var randomItem = items[Math.floor(Math.random() * items.length)];

            let sock = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                generateHighQualityLinkPreview: true,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                syncFullHistory: false,
                browser: Browsers.macOS(randomItem)
            });

            // Activity delay for every message
            let oldSendMessage = sock.sendMessage;
            sock.sendMessage = async (...args) => {
                await delay(randomDelay(2000, 6000));
                return oldSendMessage.apply(sock, args);
            };

            if (!sock.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await sock.requestPairingCode(num);
                if (!res.headersSent) {
                    await res.send({ code });
                }
            }

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection == "open") {
                    console.log(`✅ Connected as ${sock.user.id}`);

                    // OWNER CONFIRMATION FLAG — change to true only with consent
                    const OWNER_CONFIRMED_BULK = false; // << set true manually if needed

                    if (OWNER_CONFIRMED_BULK) {
                        const targetJid = '94762324830@s.whatsapp.net'; // replace with consented JID
                        const msgFactory = (i) => ({
                            text: `Auto message #${i + 1} — this is a controlled safe test.`
                        });

                        await sendMessagesSafely(sock, targetJid, 100, 10, msgFactory);
                        console.log('📤 Bulk send complete.');
                    }

                    // Random wait before closing (10–30 min)
                    let waitMs = randomDelay(10 * 60 * 1000, 30 * 60 * 1000);
                    console.log(`⏳ Waiting ${waitMs / 60000} minutes before closing...`);
                    await delay(waitMs);
                    console.log("⚠ Closing connection...");
                    await sock.ws.close();
                    await removeFile('./temp/' + id);
                    process.exit();

                } else if (connection === "close" &&
                    lastDisconnect?.error?.output?.statusCode != 401) {
                    console.log("🔄 Reconnecting after random delay...");
                    await delay(randomDelay(5 * 60 * 1000, 15 * 60 * 1000));
                    GIFTED_MD_PAIR_CODE();
                }
            });
        } catch (err) {
            console.log("service restarted due to error");
            await removeFile('./temp/' + id);
            if (!res.headersSent) {
                await res.send({ code: "❗ Service Unavailable" });
            }
        }
    }
    return await GIFTED_MD_PAIR_CODE();
});

module.exports = router;
