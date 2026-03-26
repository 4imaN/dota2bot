import {
  getHeroSummary,
  getLiveSummary,
  getLinkedProfileCard,
  getMatchSummary,
  getMetaSummary,
  getPlayerLastMatchSummary,
  getPlayerSummary
} from "./opendota.js";
import { getLinkedUser, linkUserAccount, unlinkUserAccount } from "./storage.js";

const helpText = [
  "Dota 2 Bot Commands",
  "/hero <hero name or id> - Pick rate, ban rate, win data",
  "/meta - Top pro picks, bans, and current pro drafts",
  "/match <match id> - Match summary",
  "/player <account id> - Player summary",
  "/link <account id> - Save your Dota account to Telegram",
  "/me - Show your saved account",
  "/lastmatch - Show your linked account's latest match",
  "/unlink - Remove your saved account link",
  "/live - Ongoing live matches",
  "/help - Show this help"
].join("\n");

function usage(command, example) {
  return `Usage: ${command}\nExample: ${example}`;
}

export const botCommands = [
  { command: "start", description: "Show intro and available commands" },
  { command: "help", description: "List available commands" },
  { command: "hero", description: "Hero stats by name or ID" },
  { command: "meta", description: "Top pro picks, bans, and live drafts" },
  { command: "match", description: "Match summary by match ID" },
  { command: "player", description: "Player summary by account ID" },
  { command: "link", description: "Save your Dota account ID" },
  { command: "me", description: "Show your saved account link" },
  { command: "lastmatch", description: "Latest match for your linked account" },
  { command: "unlink", description: "Remove your saved account link" },
  { command: "live", description: "Top ongoing live games" }
];

export async function handleCommand(message) {
  const trimmed = String(message?.text || "").trim();
  const [commandWithSlash, ...rest] = trimmed.split(/\s+/);
  const command = commandWithSlash.replace(/^\/+/, "").split("@")[0].toLowerCase();
  const arg = rest.join(" ").trim();
  const telegramUserId = message?.from?.id;
  const accountLink = telegramUserId ? await getLinkedUser(telegramUserId) : null;

  switch (command) {
    case "start":
      return {
        text: [
          "This bot uses OpenDota to show hero stats, pro pick and ban trends, live games, match summaries, and player info.",
          "You can also link your Dota account once and use /lastmatch anytime to see your latest match.",
          "",
          helpText
        ].join("\n")
      };
    case "help":
      return { text: helpText };
    case "hero": {
      if (!arg) {
        return { text: usage("/hero <hero name or id>", "/hero invoker") };
      }
      const result = await getHeroSummary(arg);
      if (!result) {
        return { text: `I couldn't find a hero matching "${arg}".` };
      }
      return {
        text: result.summary,
        photoUrl: result.photoUrl
      };
    }
    case "meta":
      return { text: await getMetaSummary() };
    case "match":
      if (!arg || !/^\d+$/.test(arg)) {
        return { text: usage("/match <match id>", "/match 7718123901") };
      }
      return { text: await getMatchSummary(arg) };
    case "player":
      if (!arg || !/^\d+$/.test(arg)) {
        return { text: usage("/player <account id>", "/player 86745912") };
      }
      return { text: await getPlayerSummary(arg) };
    case "link":
      if (!arg || !/^\d+$/.test(arg)) {
        return { text: usage("/link <account id>", "/link 86745912") };
      }
      if (!telegramUserId || !message?.chat?.id) {
        return { text: "I couldn't read your Telegram user info from this message." };
      }
      await linkUserAccount({
        telegramUserId,
        chatId: message.chat.id,
        username: message.from?.username,
        firstName: message.from?.first_name,
        accountId: Number(arg)
      });
      return { text: `Linked this Telegram account to Dota account ${arg}. Use /lastmatch anytime.` };
    case "me":
      if (!accountLink) {
        return { text: "No Dota account is linked yet. Use /link <account id> first." };
      }
      return await formatLinkedProfileResponse(accountLink.accountId);
    case "lastmatch":
      if (!accountLink) {
        return { text: "No linked account found. Use /link <account id> first." };
      }
      return await formatLastMatchResponse(accountLink.accountId);
    case "unlink":
      if (!telegramUserId) {
        return { text: "I couldn't read your Telegram user info from this message." };
      }
      if (!(await unlinkUserAccount(telegramUserId))) {
        return { text: "There was no linked Dota account to remove." };
      }
      return { text: "Your linked Dota account was removed." };
    case "live":
      return { text: await getLiveSummary() };
    default:
      return { text: `Unknown command.\n\n${helpText}` };
  }
}

async function formatLastMatchResponse(accountId) {
  const result = await getPlayerLastMatchSummary(accountId);
  if (typeof result === "string") {
    return { text: result };
  }

  return {
    text: result.summary,
    photoUrl: result.photoUrl
  };
}

async function formatLinkedProfileResponse(accountId) {
  const result = await getLinkedProfileCard(accountId);
  return {
    text: result.summary,
    photoUrl: result.photoUrl
  };
}
