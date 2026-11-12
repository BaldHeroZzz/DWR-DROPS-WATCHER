const fs = require("node:fs/promises");
const path = require("node:path");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID secrets.");
}

// Same Gildenscale image, four rarity markers, to verify the rarity-color mapping.
const tests = [
  ["⚪", "COMMON / GRAY"],
  ["🟢", "UNCOMMON / GREEN"],
  ["🔵", "RARE / BLUE"],
  ["🟣", "EPIC / PURPLE"]
];
const imagePath = "images/gildenscale/mage-armor.png";
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

async function sendPhoto(marker, rarity, index) {
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
  console.log(`Sent Gildenscale image for ${rarity}.`);
}

async function main() {
  for (let i = 0; i < tests.length; i++) {
    const [marker, rarity] = tests[i];
    // Separate text first, then photo, so the label visibly sits above its image.
    await telegram("sendMessage", {
      chat_id: TELEGRAM_CHAT_ID,
      text: `${marker} <b>GILDENSCALE — ${rarity}</b>`,
      parse_mode: "HTML",
      disable_web_page_preview: true
    });
    await sleep(350);
    await sendPhoto(marker, rarity, i + 1);
    console.log(`Completed rarity test ${i + 1}/${tests.length}: ${rarity}`);
    if (i < tests.length - 1) await sleep(900);
  }
  console.log("Gildenscale rarity test complete: 4 labeled photos sent individually.");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
