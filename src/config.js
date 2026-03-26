function cleanEnv(value) {
  return String(value || "").trim().replace(/^['"]|['"]$/g, "");
}

const requiredEnv = ["TELEGRAM_BOT_TOKEN"];

for (const key of requiredEnv) {
  if (!cleanEnv(process.env[key])) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const config = {
  telegramBotToken: cleanEnv(process.env.TELEGRAM_BOT_TOKEN),
  openDotaApiKey: cleanEnv(process.env.OPENDOTA_API_KEY),
  pollIntervalMs: Number(cleanEnv(process.env.POLL_INTERVAL_MS) || 1500),
  openDotaBaseUrl: "https://api.opendota.com/api"
};
