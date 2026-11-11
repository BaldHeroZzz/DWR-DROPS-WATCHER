const fs = require("node:fs");
const path = require("node:path");

const DROP_API_URL = process.env.DROP_API_URL || "https://dqr-drops.onrender.com/api/drops";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const INACTIVITY_MINUTES = Math.max(1, Number(process.env.INACTIVITY_MINUTES || 10));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID GitHub Actions secrets.");
  process.exit(1);
}

function loadState() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { latestDropId: null, lastDropAt: null, alertedDropId: null };
  }
}

function saveState(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const temp = STATE_FILE + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
  fs.renameSync(temp, STATE_FILE);
}

function getDropId(drop) {
  return String(drop.id || `${drop.createdAt || ""}|${drop.item || ""}|${drop.player || ""}`);
}

async function getLatestDrop() {
  const response = await fetch(DROP_API_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`Drop API returned HTTP ${response.status}`);
  const drops = await response.json();
  if (!Array.isArray(drops)) throw new Error("Drop API response was not an array");
  return drops[0] || null;
}

async function sendTelegramMessage(message) {
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      disable_web_page_preview: true
    }),
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.description || `Telegram returned HTTP ${response.status}`);
  }
}

async function main() {
  const latest = await getLatestDrop();
  if (!latest) {
    console.log("No drops recorded yet; nothing to alert.");
    return;
  }

  const latestId = getDropId(latest);
  const latestAt = Date.parse(latest.createdAt);
  if (!Number.isFinite(latestAt)) throw new Error("Latest drop has an invalid createdAt timestamp.");

  const state = loadState();
  if (latestId !== state.latestDropId) {
    state.latestDropId = latestId;
    state.lastDropAt = new Date(latestAt).toISOString();
    state.alertedDropId = null;
    console.log(`New latest drop: ${latest.item || "Unknown item"}`);
  } else if (!state.lastDropAt) {
    state.lastDropAt = new Date(latestAt).toISOString();
  }

  const lastDropTime = Date.parse(state.lastDropAt);
  if (!Number.isFinite(lastDropTime)) throw new Error("Saved lastDropAt timestamp is invalid.");
  const quietForMs = Date.now() - lastDropTime;
  const thresholdMs = INACTIVITY_MINUTES * 60 * 1000;

  if (quietForMs >= thresholdMs && state.alertedDropId !== latestId) {
    const quietMinutes = Math.floor(quietForMs / 60000);
    const message = [
      "⏰ DQR DROP INACTIVITY ALERT",
      `No new drops have been recorded for at least ${INACTIVITY_MINUTES} minutes.`,
      `Last drop: ${latest.item || "Unknown item"}`,
      `Player: ${latest.player || "Unknown player"}`,
      `Last drop time: ${new Date(lastDropTime).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} (Philippine time)`,
      `Quiet period: ${quietMinutes} minutes`
    ].join("\n");

    await sendTelegramMessage(message);
    state.alertedDropId = latestId;
    console.log("Telegram inactivity alert sent.");
  } else {
    console.log(`No alert needed. Quiet for ${Math.floor(quietForMs / 60000)} minute(s).`);
  }

  saveState(state);
}

main().catch(error => {
  console.error("Watcher check failed:", error);
  process.exit(1);
});
