# DQR Drop Watcher

A standalone Node.js worker that sends a Telegram phone notification when the existing DQR drop feed has had no new drop for 10 minutes.

This repository does **not** modify or host the existing Discord bot. It watches the drop API already populated by the bot in `BaldHeroZzz/DQR-DROPSS`, so it reuses the existing Discord bot and channel without starting a second Discord Gateway session.

## Behavior

- Polls the existing drop feed every 30 seconds by default.
- Uses the newest recorded drop's `createdAt` timestamp.
- Sends one Telegram alert when the feed has been quiet for 10 minutes.
- A newly recorded drop resets the inactivity window and allows one new alert for the next quiet period.
- Saves the last drop and alert state to disk so restarts do not repeatedly notify for the same drop.
- API errors do not count as inactivity; the watcher logs the error and retries.

## Required environment variables

| Variable | Description |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Token from the Telegram bot created through BotFather |
| `TELEGRAM_CHAT_ID` | Your Telegram chat ID |
| `DROP_API_URL` | Existing drop feed URL; defaults to `https://dqr-drops.onrender.com/api/drops` |

## Optional environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `INACTIVITY_MINUTES` | `10` | Minutes without a new drop before alerting |
| `POLL_INTERVAL_SECONDS` | `30` | How often to check the drop feed (minimum 10 seconds) |
| `DATA_DIR` | `./data` | Directory used to persist watcher state |

## Run locally

Requires Node.js 18 or newer.

```bash
npm start
```

Set the environment variables in your shell or hosting provider first. Never commit tokens or a `.env` file.

## Telegram setup

1. In Telegram, open the verified `@BotFather` account and create a bot with `/newbot`.
2. Copy the bot token into the host's `TELEGRAM_BOT_TOKEN` secret.
3. Open your new bot in Telegram and press **Start**.
4. Obtain your chat ID using a trusted Telegram bot/API method, then set `TELEGRAM_CHAT_ID`.
5. Never publish or send the bot token in chat or commit it to GitHub.

## Deployment notes

Deploy this repository as a continuously running **Background Worker** on a host that supports persistent storage. Set `DATA_DIR=/var/data` and mount persistent storage at `/var/data` so notification state survives restarts.

A sleeping/free web service is not suitable for reliable 24/7 monitoring. Check the host's current worker and persistent-disk pricing before deploying; this repository does not create or purchase a paid service.

## Existing integration

The source drop feed currently defaults to `https://dqr-drops.onrender.com/api/drops`, the endpoint used by the existing Discord monitor. If that service URL changes, set `DROP_API_URL` to the new `/api/drops` endpoint.
