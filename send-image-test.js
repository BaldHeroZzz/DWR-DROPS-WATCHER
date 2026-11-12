const fs = require("node:fs/promises");
const path = require("node:path");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID secrets.");
}

// Same item and sample stats; only the rarity circle changes in this test.
const tests = [
  ["⚪", "GRAY"],
  ["🟢", "GREEN"],
  ["🔵", "BLUE"],
  ["🟣", "PURPLE"]
];
const imagePath = "images/gildenscale/mage-armor.png";
const itemName = "Gildenscale Mage Armor";
const powerLine = "Power : 14.5 (100%)";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function telegram(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000)
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.description || `Telegram ${method} failed with HTTP ${response.status}`);
  }
  return result;
}

async function sendPhoto(index) {
  const bytes = await fs.readFile(path.resolve(imagePath));
  const form = new FormData();
  form.append("chat_id", TELEGRAM_CHAT_ID);
  form.append("photo", new Blob([bytes], { type: "image/png" }), path.basename(imagePath));

  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(60000)
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.description || `Telegram photo ${index} failed with HTTP ${response.status}`);
  }
}

async function main() {
  for (let i = 0; i < tests.length; i++) {
    const [marker, rarity] = tests[i];
    // Send the requested two-line label first, then the transparent item image.
    await telegram("sendMessage", {
      chat_id: TELEGRAM_CHAT_ID,
      text: `${marker} <b>${itemName}</b> ${marker}\nPower : <b>14.5 (100%)</b>`,
      parse_mode: "HTML",
      disable_web_page_preview: true
    });
    await sleep(350);
    await sendPhoto(i + 1);
    console.log(`Sent ${i + 1}/${tests.length}: ${rarity}`);
    if (i < tests.length - 1) await sleep(900);
  }
  console.log("Gildenscale format test complete: gray, green, blue, purple.");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
