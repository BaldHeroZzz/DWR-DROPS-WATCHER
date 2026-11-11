# BaldHero Drops Watcher

A standalone Node.js watcher that sends Telegram notifications for newly detected BaldHero Drops and sends an inactivity alert when no new drop appears for 10 minutes.

This repository is separate from the BaldHero-Loots application. It reads the existing feed at `https://baldhero-loots.onrender.com/api/drops` and does not modify or host the source application or its Discord bot.

## GitHub Actions (free scheduled mode)

The included workflow checks the feed every 5 minutes. It sends a Telegram message for each newly detected drop and sends at most one inactivity alert for each quiet period. A new drop resets the inactivity window. The workflow saves its state in this repository so it remembers the last checked drop across runs.

GitHub scheduled workflows can be delayed during periods of high load, so new-drop notifications and inactivity alerts are not guaranteed at the exact scheduled minute.

### Drop notification format

Each new drop message contains only the item list—no boss-defeated, boss, dungeon, or player details. Ultimate and Legendary items appear first under **HIGH VALUE DROPS**, with their item lines bolded. All remaining items appear under **OTHER DROPS**. The dot color is based on the item's `rarity` field:

| Rarity | Dot |
| --- | --- |
| Ultimate | 🔴 |
| Legendary | 🟡 |
| Mythic / Epic | 🟣 |
| Rare | 🔵 |
| Uncommon | 🟢 |
| Common / Normal | ⚪ |
| Unknown rarity | ⚪ |

Each line uses this format: `[rarity dot] x[quantity] [item name]`. Telegram HTML formatting bolds Ultimate and Legendary lines.

If multiple drops arrive between checks, the watcher sends the unseen drops in chronological order, provided the previous saved drop is still present in the feed. If it is no longer present, it sends the latest drop rather than replaying the entire feed.

### Add the required secrets

1. Open **Settings → Secrets and variables → Actions** in this repository.
2. Under **Secrets**, add:
   - `TELEGRAM_BOT_TOKEN` — your replacement token from BotFather.
   - `TELEGRAM_CHAT_ID` — your private Telegram chat ID.
3. Optional: under **Variables**, add `DROP_API_URL` only if the BaldHero feed URL changes, and `INACTIVITY_MINUTES` if you want a threshold other than 10 minutes.
4. Open **Actions → BaldHero Drops Watcher → Run workflow** to test it.

Do not put your Telegram token or chat ID in source code, README files, commits, or chat messages.

### Permissions

The workflow needs Actions enabled and **Settings → Actions → General → Workflow permissions → Read and write permissions** so it can save `data/state.json`. The workflow also declares `contents: write`.

## Behavior

- Checks the BaldHero Drops feed every 5 minutes through GitHub Actions.
- Sends a separate Telegram message for each newly detected drop, listing only the items in rarity-dot format.
- Sends one inactivity alert when the feed has been quiet for 10 minutes.
- A newly recorded drop resets the inactivity window and allows one new alert for the next quiet period.
- Saves the last drop and alert state to `data/state.json` to prevent repeat alerts across workflow runs.
- API errors fail the run and do not count as inactivity.

## Run continuously on a host instead

The original `watcher.js` is also available for a continuously running Node.js worker. It polls every 30 seconds by default and needs persistent storage for its state file. Set `DATA_DIR` to your persistent disk mount path.

## Environment variables

| Variable | Description |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Token from BotFather |
| `TELEGRAM_CHAT_ID` | Your Telegram chat ID |
| `DROP_API_URL` | Defaults to `https://baldhero-loots.onrender.com/api/drops` |
| `INACTIVITY_MINUTES` | Defaults to 10 |
| `POLL_INTERVAL_SECONDS` | Continuous mode only; defaults to 30 |
