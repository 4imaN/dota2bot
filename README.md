# Dota 2 Telegram Bot

A lightweight Telegram bot that uses the OpenDota API for hero stats, pick rates, ban rates, matches, live games, and player lookups.

## Commands

- `/start` - Intro and quick usage
- `/help` - Show all commands
- `/hero <hero name or id>` - Hero summary with pro pick/ban and public win data
- `/meta` - Top pro-picked and pro-banned heroes plus current pro drafts when available
- `/match <match id>` - Match summary
- `/player <account id>` - Player summary and recent performance
- `/link <account id>` - Save a Telegram user's Dota account ID
- `/me` - Show the saved account ID
- `/lastmatch` - Show the latest match for the saved account
- `/unlink` - Remove the saved account link
- `/live` - Top ongoing live games

## Setup

1. Create a bot with BotFather and copy the token.
2. Copy `.env.example` to `.env`.
3. Fill in `TELEGRAM_BOT_TOKEN`.
4. Leave `OPENDOTA_API_KEY` blank if you want to use OpenDota without a key.
5. Add `OPENDOTA_API_KEY` only if you want higher rate limits.
6. Start the bot:

```bash
npm start
```

## Notes

- This project uses Node 22's built-in `fetch`, so there are no runtime dependencies.
- The included `api.json` is the OpenAPI description for OpenDota and acts as the API reference for the bot.
- OpenDota works without an API key. A key just increases rate limits and usage allowances.
- User links are persisted locally in `data/users.json`. This is a simple file-backed database for now and can be replaced with SQLite or Postgres later.
