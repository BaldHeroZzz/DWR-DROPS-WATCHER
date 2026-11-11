# BaldHero Drops Watcher

A standalone Node.js watcher that sends a Telegram phone notification when the BaldHero Drops feed has had no new drop for 10 minutes.

This repository is separate from the BaldHero-Loots application. It reads the existing feed at `https://baldhero-loots.onrender.com/api/drops` and does not modify or host the source application or its Discord bot.

## GitHub Actions (free scheduled mode)

The included workflow checks the feed every 5 minutes and sends at most one alert for each quiet period. A new drop resets the inactivity window. The workflow saves its state in this repository so it remembers the last checked drop across runs.

GitHub scheduled workflows can be delayed during periods of high load, so alerts are not guaranteed at the exact 10-minute mark. In normal conditions, an alert is sent on the first check after the 10-minute threshold.

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

- Checks the newest entry from the BaldHero Drops feed every 5 minutes through GitHub Actions.
- Uses the newest record's `timestamp`, `author`, `dungeon`, `boss`, and `items` fields.
- Sends one Telegram alert when the feed has been quiet for 10 minutes.
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
