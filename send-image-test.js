const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID secrets.");
}

const base = "https://raw.githubusercontent.com/BaldHeroZzz/DWR-DROPS-WATCHER/main/images";
const images = [
  ["gildenscale/mage-armor.png", "🔵 Gildenscale Mage Armor"],
  ["gildenscale/mage-helmet.png", "🔵 Gildenscale Mage Helmet"],
  ["gildenscale/warrior-armor.png", "🔴 Gildenscale Warrior Armor"],
  ["gildenscale/warrior-helmet.png", "🔴 Gildenscale Warrior Helmet"],
  ["gildenscale/guarding-armor.png", "🟢 Gildenscale Guarding Armor"],
  ["gildenscale/guarding-helmet.png", "🟢 Gildenscale Guarding Helmet"],
  ["legendary/mage-legendary-weapons.png", "🟡 Mage Legendary Weapons"],
  ["legendary/warrior-legendary-weapons.png", "🟡 Warrior Legendary Weapons"],
  ["legendary/enhanced-inner-focus.png", "🟡 Enhanced Inner Focus"],
  ["legendary/enhanced-inner-rage.png", "🟡 Enhanced Inner Rage"],
  ["ultimate/lumenflames-absolution.png", "🔴 Ultimate — Lumenflame's Absolution (Mage)"],
  ["ultimate/lumenflames-judgement.png", "🔴 Ultimate — Lumenflame's Judgement (Warrior)"]
];

async function sendGroup(group, index) {
  const media = group.map(([file, caption]) => ({
    type: "photo",
    media: `${base}/${file}`,
    caption
  }));
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMediaGroup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, media }),
    signal: AbortSignal.timeout(60000)
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.description || `Telegram image group ${index} failed with HTTP ${response.status}`);
  }
  console.log(`Sent image group ${index} (${group.length} images).`);
}

async function main() {
  for (let i = 0; i < images.length; i += 10) {
    await sendGroup(images.slice(i, i + 10), Math.floor(i / 10) + 1);
  }
  console.log(`Image test complete: sent ${images.length} images.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
