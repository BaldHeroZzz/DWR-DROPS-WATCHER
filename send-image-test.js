const fs = require("node:fs/promises");
const path = require("node:path");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID secrets.");
}

const images = [
  ["images/gildenscale/mage-armor.png", "🔵", "GILDENSCALE MAGE ARMOR"],
  ["images/gildenscale/mage-helmet.png", "🔵", "GILDENSCALE MAGE HELMET"],
  ["images/gildenscale/warrior-armor.png", "🔴", "GILDENSCALE WARRIOR ARMOR"],
  ["images/gildenscale/warrior-helmet.png", "🔴", "GILDENSCALE WARRIOR HELMET"],
  ["images/gildenscale/guarding-armor.png", "🟢", "GILDENSCALE GUARDING ARMOR"],
  ["images/gildenscale/guarding-helmet.png", "🟢", "GILDENSCALE GUARDING HELMET"],
  ["images/legendary/mage-legendary-weapons.png", "🟡", "MAGE LEGENDARY WEAPONS"],
  ["images/legendary/warrior-legendary-weapons.png", "🟡", "WARRIOR LEGENDARY WEAPONS"],
  ["images/legendary/enhanced-inner-focus.png", "🟡", "ENHANCED INNER FOCUS"],
  ["images/legendary/enhanced-inner-rage.png", "🟡", "ENHANCED INNER RAGE"],
  ["images/ultimate/lumenflames-absolution.png", "🔴", "ULTIMATE — LUMENFLAME'S ABSOLUTION (MAGE)"],
  ["images/ultimate/lumenflames-judgement.png", "🔴", "ULTIMATE — LUMENFLAME'S JUDGEMENT (WARRIOR)"]
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function sendPhoto(file, marker, title, index) {
  const bytes = await fs.readFile(path.resolve(file));
  const form = new FormData();
  form.append("chat_id", TELEGRAM_CHAT_ID);
  form.append("parse_mode", "HTML");
  form.append("caption", `${marker} <b>${title}</b>`);
  form.append("photo", new Blob([bytes], { type: "image/png" }), path.basename(file));

  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(60000)
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.description || `Telegram photo ${index} failed with HTTP ${response.status}`);
  }
  console.log(`Sent ${index}/${images.length}: ${title}`);
}

async function main() {
  for (let i = 0; i < images.length; i++) {
    const [file, marker, title] = images[i];
    await sendPhoto(file, marker, title, i + 1);
    if (i < images.length - 1) await sleep(900);
  }
  console.log(`Image test complete: sent ${images.length} photos individually.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
