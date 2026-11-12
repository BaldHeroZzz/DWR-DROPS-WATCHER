# BaldHero Drops Watcher

A standalone Telegram notifier for selected BaldHero Drops. It reads the existing feed at `https://baldhero-loots.onrender.com/api/drops` and does not modify the BaldHero-Loots application or its Discord bot.

## Scheduled checks

The GitHub Actions workflow is intended to be triggered every 5 minutes. cron-job.org can also trigger the workflow using GitHub's workflow-dispatch API. Each successful check sends a run-completion message to Telegram, with a counter that increases and persists across runs:

```
✅ A (x1) run is completed for (5 minutes duration)
✅ A (x2) run is completed for (5 minutes duration)
✅ A (x3) run is completed for (5 minutes duration)
```

The counter increments once after the feed has been fetched and processed successfully and the completion message has been accepted by Telegram. Manual successful workflow runs also increment the counter.

## Drop notifications

Only these items are sent to Telegram:
- Gildenscale items, preserving the original Discord drop color (gray ⚪, green 🟢, blue 🔵, or purple 🟣)
- Legendary items (yellow 🟡)
- Ultimate items (red 🔴)

All other items are ignored. If a drop contains multiple matching items, identical item names and rarities are combined into one quantity line. Drop messages include the drop timestamp in Philippine Time (PHT), plus each item's Power/Potential and percentage when those values are present in the Discord record. Gildenscale color emojis are read from the original Discord message instead of being inferred from rarity. Legendary and Ultimate lines are bold.

The first successful run establishes the current latest drop as a baseline and does not replay historical drops.

## Required GitHub secrets

Under **Settings → Secrets and variables → Actions → Secrets**, configure:
- `TELEGRAM_BOT_TOKEN` — the bot token from BotFather.
- `TELEGRAM_CHAT_ID` — the destination chat ID.

Do not put the Telegram token or chat ID in source code, README files, commits, or chat messages.

## State persistence

The workflow needs **Settings → Actions → General → Workflow permissions → Read and write permissions** and declares `contents: write` so it can save `data/state.json`. This file stores the latest processed drop ID and the cumulative successful-run counter.

## Environment variables

| Variable | Description |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (required) |
| `TELEGRAM_CHAT_ID` | Telegram destination chat ID (required) |
| `DROP_API_URL` | Drop feed URL; defaults to the BaldHero feed above |
