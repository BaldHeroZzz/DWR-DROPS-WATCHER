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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getItemColorEmoji(item, drop) {
  const validColors = new Set(["⚪", "🔵", "🟢", "🟣", "🟡", "🔴", "🟠"]);
  const rawText = String(drop.rawText || "");
  const name = String(item.name || "").trim();
  if (rawText && name) {
    const pattern = new RegExp("([⚪🔵🟢🟣🟡🔴🟠])\\s*" + escapeRegExp(name) + "\\s*,", "i");
    const match = rawText.match(pattern);
    if (match && validColors.has(match[1])) return match[1];
  }
  const fallback = rarityEmoji(item.rarity);
  return validColors.has(fallback) ? fallback : "⚪";
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

function toUnicodeBold(value) {
  const normal = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bold = "𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗";
  return [...String(value)].map(character => {
    const index = normal.indexOf(character);
    return index >= 0 ? [...bold][index] : character;
  }).join("");
}

function getWantedItems(drop) {
  return combineDuplicateItems((Array.isArray(drop.items) ? drop.items : []).filter(isWantedItem));
}

function formatDropItem(item, drop) {
  const emoji = getItemColorEmoji(item, drop);
  const quantity = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
  const quantityText = quantity > 1 ? `x${quantity} ` : "";
  const name = toUnicodeBold(String(item.name || "Unknown item").toUpperCase());
  const title = `${emoji} ${quantityText}${name} ${emoji}`;
  const power = String(item.potential || "").trim();
  const percent = Number.isFinite(Number(item.percent)) && item.percent !== null && item.percent !== ""
    ? ` (${Number(item.percent)}%)`
    : "";
  const stats = power
    ? `\n\n${toUnicodeBold("Power :")} ${toUnicodeBold(power + percent)}`
    : percent
      ? `\n\n${toUnicodeBold("Potential :")} ${toUnicodeBold(percent.trim().replace(/^\(|\)$/g, ""))}`
      : "";
  return title + stats;
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

function toWellFormedUnicode(value) {
  const input = String(value);
  let output = "";
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code >= 0xD800 && code <= 0xDBFF) {
      const next = input.charCodeAt(i + 1);
      if (next >= 0xDC00 && next <= 0xDFFF) {
        output += input[i] + input[i + 1];
        i++;
      } else {
        output += "\uFFFD";
      }
    } else if (code >= 0xDC00 && code <= 0xDFFF) {
      output += "\uFFFD";
    } else {
      output += input[i];
    }
  }
  return output;
}

async function sendTelegramMessage(message) {
  const safeMessage = toWellFormedUnicode(message);
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: safeMessage,
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

function getItemImagePath(item) {
  const name = String(item.name || "").toLowerCase();
  const base = path.join(__dirname, "images");

  if (name.includes("lumenflame") && name.includes("absolution")) {
    return path.join(base, "ultimate", "lumenflames-absolution.png");
  }
  if (name.includes("lumenflame") && name.includes("judgement")) {
    return path.join(base, "ultimate", "lumenflames-judgement.png");
  }
  if (name.includes("enhanced inner focus")) {
    return path.join(base, "legendary", "enhanced-inner-focus.png");
  }
  if (name.includes("enhanced inner rage")) {
    return path.join(base, "legendary", "enhanced-inner-rage.png");
  }
  if (name.includes("daybreak") || name.includes("gildensong")) {
    return path.join(base, "legendary", "mage-legendary-weapons.png");
  }
  if (name.includes("gildenscale oath") || name.includes("aegis")) {
    return path.join(base, "legendary", "warrior-legendary-weapons.png");
  }
  if (name.includes("gildenscale")) {
    const className = (name.includes("guardian") || name.includes("guarding")) ? "guarding"
      : name.includes("warrior") ? "warrior"
      : name.includes("mage") ? "mage" : null;
    if (!className) return null;
    const slot = name.includes("helmet") ? "helmet"
      : name.includes("armor") ? "armor" : null;
    if (!slot) return null;
    return path.join(base, "gildenscale", `${className}-${slot}.png`);
  }
  return null;
}

async function sendTelegramPhoto(photoPath) {
  if (!photoPath || !fs.existsSync(photoPath)) {
    console.log(`No matching image file found for: ${photoPath || "unmapped item"}`);
    return;
  }

  const form = new FormData();
  form.append("chat_id", TELEGRAM_CHAT_ID);
  form.append("photo", new Blob([fs.readFileSync(photoPath)]), path.basename(photoPath));

  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(30000)
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.description || `Telegram photo upload returned HTTP ${response.status}`);
  }
  console.log(`Telegram item image sent: ${path.basename(photoPath)}`);
}

async function sendRunCompletion(dungeonCount) {
  const count = Math.max(0, Number(dungeonCount) || 0);
  const label = count === 1 ? "Dungeon Completed" : "Dungeons Completed";
  await sendTelegramMessage(`✅ x${count} ${label} (Last ${RUN_DURATION_LABEL})`);
  console.log(`Telegram dungeon-completion notification sent: x${count}`);
}

async function main() {
  const drops = await getDrops();
  const state = loadState();
  const latest = drops[0] || null;
  let completedDungeons = 0;

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
      completedDungeons = unseenDrops.length;

      for (const drop of unseenDrops) {
        const dropId = getDropId(drop);
        const dropAt = Date.parse(drop.timestamp);
        if (!Number.isFinite(dropAt)) throw new Error("A new BaldHero drop has an invalid timestamp.");

        const items = getWantedItems(drop);
        if (items.length) {
          for (const item of items) {
            await sendTelegramMessage(formatDropItem(item, drop));
            await sendTelegramPhoto(getItemImagePath(item));
          }
          console.log(`Telegram item notifications and matching images sent: ${dropId}`);
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

  await sendRunCompletion(completedDungeons);
}

main().catch(error => {
  console.error("Watcher check failed:", error);
  process.exit(1);
});
