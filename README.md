# DQR Drop Watcher

A standalone Node.js watcher that sends a Telegram phone notification when the existing DQR drop feed has had no new drop for 10 minutes.

This repository does **not** modify or host the existing Discord bot. It watches the drop API already populated by the bot in `BaldHeroZzz/DQR-DROPSS`, so it reuses the existing Discord bot and channel without starting a second Discord Gateway session.

## GitHub Actions (free scheduled mode)

The included workflow checks the drop feed every 5 minutes and sends at most one alert for each quiet period. A new drop resets the inactivity window. The workflow saves its small state file in this repository so it can remember which drop was last checked across runs.

GitHub's scheduled workflows can be delayed during periods of high load, so alerts are not guaranteed at the exact 10-minute mark. The schedule checks every 5 minutes; in normal conditions, an inactivity alert will be sent on the first check after the 10-minute threshold.

### Add the required secrets

1. Open **Settings → Secrets and variables → Actions** in this repository.
2. Under **Secrets**, choose **New repository secret** and add:
   - `TELEGRAM_BOT_TOKEN` — your replacement token from BotFather. Do not use the token previously exposed in chat.
   - `TELEGRAM_CHAT_ID` — your private Telegram chat ID.
3. Optional: under **Variables**, add `DROP_API_URL` if the drop API URL changes, and `INACTIVITY_MINUTES` if you want a threshold other than 10 minutes.
4. Open the **Actions** tab, select **DQR Drop Watcher**, and choose **Run workflow** to test it.

Do not put your Telegram token or chat ID in source code, README files, commits, or chat messages. GitHub Actions secrets keep the token out of the public repository.

### Permissions

The workflow needs repository **Actions** enabled and **Settings → Actions → General → Workflow permissions → Read and write permissions** so it can save `data/state.json`. The workflow also declares `contents: write`.

## Behavior

- Checks the newest entry from the existing drop feed every 5 minutes through GitHub Actions.
- Uses the newest recorded drop's `createdAt` timestamp.
- Sends one Telegram alert when the feed has been quiet for 10 minutes.
- A newly recorded drop resets the inactivity window and allows one new alert for the next quiet period.
- Saves the last drop and alert state to `data/state.json` to prevent repeat alerts across workflow runs.
- API errors fail the run and do not count as inactivity.

## Run continuously on a host instead

The original `watcher.js` is also available for a continuously running Node.js worker. It polls every 30 seconds by default and needs persistent storage for its state file. Set `DATA_DIR` to your persistent disk mount path.

## Required environment variables

| Variable | Description |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Token from the Telegram bot created through BotFather |
| `TELEGRAM_CHAT_ID` | Your Telegram chat ID |
| `DROP_API_URL` | Existing drop feed URL; defaults to `https://dqr-drops.onrender.com/api/drops` |

## Existing integration

The source drop feed currently defaults to `https://dqr-drops.onrender.com/api/drops`, the endpoint used by the existing Discord monitor. If that service URL changes, set `DROP_API_URL` to the new `/api/drops` endpoint.
