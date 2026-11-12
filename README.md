# BaldHero Drops Watcher

A standalone Telegram notifier for selected BaldHero Drops. It reads the existing feed at `https://baldhero-loots.onrender.com/api/drops` and does not modify the BaldHero-Loots application or its Discord bot.

## Scheduled checks

GitHub Actions is scheduled to check the feed every 5 minutes (at minutes 2, 7, 12, and so on). A manual run is also available through the Actions tab.

After each successful check, Telegram receives a separate completion message with a persistent counter:

```
✅ A (x1) run is completed for (5 minutes duration)
✅ A (x2) run is completed for (5 minutes duration)
```

The counter increments only after Telegram accepts the completion message. The watcher does not send the old inactivity/no-drop alerts.

## Drop notifications

Only these items are sent:
- Gildenscale items, preserving their original Discord rarity color (gray ⚪, green 🟢, blue 🔵, or purple 🟣)
- Legendary items (yellow 🟡)
- Ultimate items (red 🔴)

Each matching item is sent as its own Telegram text message, followed immediately by its matching image when one is available. The item name and Power/Potential line use bold Unicode characters. Quantity is omitted for x1 and shown as x2, x3, etc. for duplicates. Boss-defeated messages and other item rarities are ignored.

The first successful run establishes the current latest drop as a baseline and does not replay historical drops.

## Required GitHub secrets

Under **Settings → Secrets and variables → Actions → Secrets**, configure:
- `TELEGRAM_BOT_TOKEN` — the bot token from BotFather.
- `TELEGRAM_CHAT_ID` — the destination chat ID.

Keep both values private; never put them in source code or commits.

## State persistence

The workflow needs **Settings → Actions → General → Workflow permissions → Read and write permissions** and declares `contents: write` so it can save `data/state.json`. The file stores the latest processed drop ID and the successful-run counter.

## Environment variables

| Variable | Description |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Required Telegram bot token |
| `TELEGRAM_CHAT_ID` | Required Telegram destination chat ID |
| `DROP_API_URL` | Optional feed URL; defaults to the BaldHero feed |
