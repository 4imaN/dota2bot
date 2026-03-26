import { config } from "./config.js";

const telegramBaseUrl = `https://api.telegram.org/bot${config.telegramBotToken}`;

async function telegramRequest(method, body = {}) {
  const response = await fetch(`${telegramBaseUrl}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Telegram request failed (${response.status}): ${text.slice(0, 200)}`);
  }

  const payload = await response.json();
  if (!payload.ok) {
    throw new Error(`Telegram API error: ${payload.description}`);
  }

  return payload.result;
}

export function escapeMarkdown(text) {
  return String(text).replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

export async function setCommands(commands) {
  return telegramRequest("setMyCommands", {
    commands
  });
}

export async function getUpdates(offset) {
  return telegramRequest("getUpdates", {
    offset,
    timeout: 20,
    allowed_updates: ["message"]
  });
}

export async function getUserProfilePhotos(userId, limit = 1) {
  return telegramRequest("getUserProfilePhotos", {
    user_id: userId,
    limit
  });
}

export async function sendMessage(chatId, text, extra = {}) {
  return telegramRequest("sendMessage", {
    chat_id: chatId,
    text,
    ...extra
  });
}

export async function sendPhoto(chatId, photo, caption, extra = {}) {
  return telegramRequest("sendPhoto", {
    chat_id: chatId,
    photo,
    caption,
    ...extra
  });
}
