const fs = require("node:fs");
const path = require("node:path");

const DROP_API_URL = process.env.DROP_API_URL || "https://baldhero-loots.onrender.com/api/drops";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");
const RUN_DURATION_LABEL = "5 minutes";

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
    return { latestDropId: null, completedRuns: 0 };
  }
}

function saveState(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const temp = STATE_FILE + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
  fs.renameSync(temp, STATE_FILE);
}

function getDropId(drop) {
  return String(drop.id || `${drop.timestamp || ""}|${drop.author || ""}|${drop.dungeon || ""}`);
}

function rarityEmoji(rarity) {
  const value = String(rarity || "").trim().toLowerCase();
  if (["ultimate", "ultra"].includes(value)) return "🔴";
  if (["legendary", "legend"].includes(value)) return "🟡";
  if (["mythic", "epic", "gilded"].includes(value)) return "🟣";
  if (["rare", "blue"].includes(value)) return "🔵";
  if (["uncommon", "green"].includes(value)) return "🟢";
  if (["common", "gray", "grey"].includes(value)) return "⚪";
  return "⚪";
}

function getItemColorEmoji(item, drop) {
  const rawText = String(drop.rawText || "");
  const name = String(item.name || "").trim();
  if (rawText && name) {
    const pattern = new RegExp("([⚪🔵🟢🟣🟡🔴🟠])\\s*" + name + "\\s*,", "i");
    const match = rawText.match(pattern);
    if (match) return match[1];
  }
  return rarityEmoji(item.rarity);
}

function isWantedItem(item) {");
}

function getItemColorEmoji(item, drop) {
  const rawText = String(drop.rawText || "");
  const name = String(item.name || "").trim();
  if (rawText && name) {
    const pattern = new RegExp("([⚪🔵🟢🟣🟡🔴🟠])\\s*" + escapeRegExp(name) + "\\s*,", "i");
    const match = rawText.match(pattern);
    if (match) return match[1];
  }
  return rarityEmoji(item.rarity);
}

function isWantedItem(item) {
  const rarity = String(item.rarity || "").trim().toLowerCase();
  const name = String(item.name || "").trim().toLowerCase();
  return name.includes("gildenscale")
    || ["ultimate", "ultra", "legendary", "legend"].includes(rarity);
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

function combineDuplicateItems(items) {
  const combined = new Map();
  for (const item of items) {
    const name = String(item.name || "Unknown item").trim();
    const rarity = String(item.rarity || "").trim();
    const key = JSON.stringify([name.toLowerCase(), rarity.toLowerCase()]);
    const quantity = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
    if (combined.has(key)) combined.get(key).quantity += quantity;
    else combined.set(key, { ...item, name, rarity, quantity });
  }
  return [...combined.values()];
}

function formatDropItem(item, drop) {
  const quantity = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
  const line = `${getItemColorEmoji(item, drop)} x${quantity} ${escapeHtml(item.name || "Unknown item")}`;
  const power = String(item.potential || "").trim();
  const percent = Number.isFinite(Number(item.percent)) && item.percent !== null && item.percent !== ""
    ? ` · ${Number(item.percent)}%`
    : "";
  const stats = power
    ? `\n   ⚡ Power: ${escapeHtml(power)}${percent}`
    : percent
      ? `\n   📊 Potential: ${percent.slice(3)}`
      : "";
  const formatted = line + stats;
  return isHighValue(item) ? `<b>${formatted}</b>` : formatted;
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
  const items = combineDuplicateItems((Array.isArray(drop.items) ? drop.items : []).filter(isWantedItem));
  if (!items.length) return null;
  const highValue = items.filter(isHighValue);
  const gildenscales = items.filter(item => !isHighValue(item));
  const sections = ["📦 <b>NEW BALDHERO DROP</b>", formatDropTimestamp(drop)];
  if (highValue.length) {
    sections.push("🔥 <b>LEGENDARY / ULTIMATE</b>", highValue.map(item => formatDropItem(item, drop)).join("\n"));
  }
  if (gildenscales.length) {
    sections.push("⚔️ <b>GILDENSCALE DROPS</b>", gildenscales.map(item => formatDropItem(item, drop)).join("\n"));
  }
  return sections.join("\n\n");
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
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: true
    }),
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.description || `Telegram returned HTTP ${response.status}`);
  }
}

async function sendRunCompletion(state) {
  const nextRun = Math.max(0, Number(state.completedRuns) || 0) + 1;
  await sendTelegramMessage(`✅ A (x${nextRun}) run is completed for (${RUN_DURATION_LABEL} duration)`);
  state.completedRuns = nextRun;
  saveState(state);
  console.log(`Telegram run-completion notification sent: x${nextRun}`);
}

async function main() {
  const drops = await getDrops();
  const state = loadState();
  const latest = drops[0] || null;

  if (latest) {
    const latestId = getDropId(latest);
    const latestAt = Date.parse(latest.timestamp);
    if (!Number.isFinite(latestAt)) throw new Error("Latest BaldHero drop has an invalid timestamp.");

    if (!state.latestDropId) {
      state.latestDropId = latestId;
      saveState(state);
      console.log("Saved the current latest drop as the initial baseline.");
    } else if (latestId !== state.latestDropId) {
      const previousIndex = drops.findIndex(drop => getDropId(drop) === state.latestDropId);
      const unseenDrops = previousIndex >= 0 ? drops.slice(0, previousIndex).reverse() : [latest];

      for (const drop of unseenDrops) {
        const dropId = getDropId(drop);
        const dropAt = Date.parse(drop.timestamp);
        if (!Number.isFinite(dropAt)) throw new Error("A new BaldHero drop has an invalid timestamp.");

        const message = formatNewDrop(drop);
        if (message) {
          await sendTelegramMessage(message);
          console.log(`Telegram filtered drop notification sent: ${dropId}`);
        } else {
          console.log(`No Gildenscale, Legendary, or Ultimate items in drop: ${dropId}`);
        }
        state.latestDropId = dropId;
        saveState(state);
      }
    }
  } else {
    console.log("BaldHero Drops has no records yet.");
  }

  await sendRunCompletion(state);
}

main().catch(error => {
  console.error("Watcher check failed:", error);
  process.exit(1);
});
