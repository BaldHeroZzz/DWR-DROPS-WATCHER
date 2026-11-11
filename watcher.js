const fs = require("node:fs");
const path = require("node:path");

const DROP_API_URL = process.env.DROP_API_URL || "https://baldhero-loots.onrender.com/api/drops";
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
let state = { latestDropId: null, lastDropAt: null, alertedDropId: null };
let checking = false;

function loadState() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try {
    const saved = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    state = { ...state, ...saved };
  } catch (error) {
    if (error.code !== "ENOENT") console.error("Could not read saved state:", error.message);
  }
}

function saveState() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tempFile = STATE_FILE + ".tmp";
  fs.writeFileSync(tempFile, JSON.stringify(state, null, 2), { mode: 0o600 });
  fs.renameSync(tempFile, STATE_FILE);
}

async function getDrops() {
  const response = await fetch(DROP_API_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(90000)
  });
  if (!response.ok) throw new Error(`Drop API returned HTTP ${response.status}`);
  const drops = await response.json();
  if (!Array.isArray(drops)) throw new Error("BaldHero Drops API response was not an array");
  return drops;
}

async function sendTelegramMessage(message) {
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: "HTML", disable_web_page_preview: true }),
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.description || `Telegram returned HTTP ${response.status}`);
  }
}

function dropIdentifier(drop) {
  return String(drop.id || `${drop.timestamp || ""}|${drop.author || ""}|${drop.dungeon || ""}`);
}

function rarityEmoji(rarity) {
  const value = String(rarity || "").trim().toLowerCase();
  if (["ultimate", "ultra"].includes(value)) return "🔴";
  if (["legendary", "legend"].includes(value)) return "🟡";
  if (["mythic", "epic", "gilded"].includes(value)) return "🟣";
  if (["rare"].includes(value)) return "🔵";
  if (["uncommon", "green"].includes(value)) return "🟢";
  if (["common", "normal", "gray", "grey"].includes(value)) return "⚪";
  return "⚪";
}

function isHighValue(item) {
  const rarity = String(item.rarity || "").trim().toLowerCase();
  return ["ultimate", "ultra", "legendary", "legend"].includes(rarity);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  })[character]);
}

function formatDropItem(item) {
  const quantity = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
  const line = `${rarityEmoji(item.rarity)} x${quantity} ${escapeHtml(item.name || "Unknown item")}`;
  return isHighValue(item) ? `<b>${line}</b>` : line;
}

function formatDropItems(drop) {
  const items = Array.isArray(drop.items) ? drop.items : [];
  if (!items.length) return "No item details";
  return items.map(formatDropItem).join("\n");
}

function formatDropTimestamp(drop) {
  const timestamp = Date.parse(drop.timestamp);
  if (!Number.isFinite(timestamp)) return "🕒 Time unavailable";
  const formatted = new Date(timestamp).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
  return `🕒 ${formatted} (PHT)`;
}

function formatNewDrop(drop) {
  const items = Array.isArray(drop.items) ? drop.items : [];
  const highValue = items.filter(isHighValue);
  const otherDrops = items.filter(item => !isHighValue(item));
  const sections = ["📦 <b>NEW BALDHERO DROP</b>", formatDropTimestamp(drop)];

  if (highValue.length) {
    sections.push("🔥 <b>HIGH VALUE DROPS</b>", highValue.map(formatDropItem).join("\n"));
  }
  if (otherDrops.length) {
    sections.push("📦 <b>OTHER DROPS</b>", otherDrops.map(formatDropItem).join("\n"));
  }
  if (!items.length) sections.push("No item details");

  return sections.join("\n\n");
}

async function checkForInactivity() {
  if (checking) return;
  checking = true;
  try {
    const drops = await getDrops();
    const latest = drops[0] || null;
    if (!latest) {
      console.log("BaldHero Drops has no records yet.");
      return;
    }

    const latestId = dropIdentifier(latest);
    const latestAt = Date.parse(latest.timestamp);
    if (!Number.isFinite(latestAt)) {
      console.warn("Latest BaldHero drop has no valid timestamp; skipping this check.");
      return;
    }

    if (!state.latestDropId) {
      state.latestDropId = latestId;
      state.lastDropAt = new Date(latestAt).toISOString();
      state.alertedDropId = null;
      saveState();
      console.log("Saved the current latest drop as the initial baseline.");
      return;
    }

    if (latestId !== state.latestDropId) {
      const previousIndex = drops.findIndex(drop => dropIdentifier(drop) === state.latestDropId);
      const unseenDrops = previousIndex >= 0
        ? drops.slice(0, previousIndex).reverse()
        : [latest];

      for (const drop of unseenDrops) {
        const dropId = dropIdentifier(drop);
        const dropAt = Date.parse(drop.timestamp);
        if (!Number.isFinite(dropAt)) throw new Error("A new BaldHero drop has an invalid timestamp.");

        await sendTelegramMessage(formatNewDrop(drop));
        state.latestDropId = dropId;
        state.lastDropAt = new Date(dropAt).toISOString();
        state.alertedDropId = null;
        saveState();
        console.log(`Telegram new-drop notification sent: ${dropId}`);
      }
    } else if (!state.lastDropAt) {
      state.lastDropAt = new Date(latestAt).toISOString();
      saveState();
    }

    const lastDropTime = Date.parse(state.lastDropAt);
    if (!Number.isFinite(lastDropTime)) throw new Error("Saved lastDropAt timestamp is invalid.");
    const quietFor = Date.now() - lastDropTime;
    if (quietFor < INACTIVITY_MS || state.alertedDropId === latestId) return;

    const message = [
      "⏰ BALDHERO DROPS INACTIVITY ALERT",
      `No new drops have been detected for at least ${INACTIVITY_MINUTES} minutes.`,
      "Last recorded drops:",
      formatDropItems(latest),
      `Last drop: ${new Date(lastDropTime).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} (Philippine time)`,
      `Quiet period: ${Math.floor(quietFor / 60000)} minutes`
    ].join("\n\n");

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
console.log("BaldHero Drops Watcher starting.");
console.log(`Drop feed: ${DROP_API_URL}`);
console.log(`Inactivity threshold: ${INACTIVITY_MINUTES} minutes`);
console.log(`Poll interval: ${POLL_INTERVAL_SECONDS} seconds`);
console.log(`State file: ${STATE_FILE}`);

checkForInactivity();
setInterval(checkForInactivity, POLL_INTERVAL_SECONDS * 1000);
