const fs = require("node:fs");
const path = require("node:path");

const DROP_API_URL = process.env.DROP_API_URL || "https://dqr-drops.onrender.com/api/drops";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const INACTIVITY_MINUTES = Math.max(1, Number(process.env.INACTIVITY_MINUTES || 10));
const POLL_INTERVAL_SECONDS = Math.max(10, Number(process.env.POLL_INTERVAL_SECONDS || 30));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID.");
  process.exit(1);
}

const INACTIVITY_MS = INACTIVITY_MINUTES * 60 * 1000;
let state = {
  latestDropId: null,
  lastDropAt: null,
  alertedDropId: null
};
let checking = false;

function loadState() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try {
    const saved = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    state = { ...state, ...saved };
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Could not read saved state; starting with fresh state:", error.message);
    }
  }
}

function saveState() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tempFile = STATE_FILE + ".tmp";
  fs.writeFileSync(tempFile, JSON.stringify(state, null, 2), { mode: 0o600 });
  fs.renameSync(tempFile, STATE_FILE);
}

async function getLatestDrop() {
  const response = await fetch(DROP_API_URL, {
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`Drop API returned HTTP ${response.status}`);
  const drops = await response.json();
  if (!Array.isArray(drops)) throw new Error("Drop API response was not an array");
  return drops[0] || null;
}

async function sendTelegramMessage(text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      disable_web_page_preview: true
    }),
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.description || `Telegram returned HTTP ${response.status}`);
  }
}

function dropIdentifier(drop) {
  return String(drop.id || `${drop.createdAt || ""}|${drop.item || ""}|${drop.player || ""}`);
}

function formatDuration(milliseconds) {
  const minutes = Math.floor(milliseconds / 60000);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

async function checkForInactivity() {
  if (checking) return;
  checking = true;
  try {
    const latest = await getLatestDrop();
    if (!latest) {
      console.log("No drops have been recorded yet; waiting for the first drop.");
      return;
    }

    const latestId = dropIdentifier(latest);
    const latestAt = Date.parse(latest.createdAt);
    if (!Number.isFinite(latestAt)) {
      console.warn("Latest drop has no valid createdAt timestamp; skipping this check.");
      return;
    }

    if (latestId !== state.latestDropId) {
      state.latestDropId = latestId;
      state.lastDropAt = new Date(latestAt).toISOString();
      state.alertedDropId = null;
      saveState();
      console.log(`New latest drop detected: ${latest.item || "Unknown item"} at ${state.lastDropAt}`);
    } else if (!state.lastDropAt) {
      state.lastDropAt = new Date(latestAt).toISOString();
      saveState();
    }

    const lastDropTime = Date.parse(state.lastDropAt);
    const quietFor = Date.now() - lastDropTime;
    if (quietFor < INACTIVITY_MS || state.alertedDropId === latestId) return;

    const message = [
      "⏰ DQR DROP INACTIVITY ALERT",
      `No new drops have been detected for at least ${INACTIVITY_MINUTES} minutes.`,
      `Last drop: ${latest.item || "Unknown item"}`,
      `Player: ${latest.player || "Unknown player"}`,
      `Last detected: ${new Date(lastDropTime).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} (Philippine time)`,
      `Quiet period: ${formatDuration(quietFor)}`
    ].join("\n");

    await sendTelegramMessage(message);
    state.alertedDropId = latestId;
    saveState();
    console.log(`Telegram inactivity alert sent for drop ${latestId}.`);
  } catch (error) {
    console.error("Watcher check failed; it will retry on the next poll:", error.message);
  } finally {
    checking = false;
  }
}

loadState();
console.log("DQR Drop Watcher starting.");
console.log(`Drop feed: ${DROP_API_URL}`);
console.log(`Inactivity threshold: ${INACTIVITY_MINUTES} minutes`);
console.log(`Poll interval: ${POLL_INTERVAL_SECONDS} seconds`);
console.log(`State file: ${STATE_FILE}`);

checkForInactivity();
setInterval(checkForInactivity, POLL_INTERVAL_SECONDS * 1000);
