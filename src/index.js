import { handleCommand, botCommands } from "./commands.js";
import { config } from "./config.js";
import { getUpdates, sendMessage, sendPhoto, setCommands } from "./telegram.js";

async function processMessage(message) {
  if (!message?.text || !message.chat?.id) {
    return;
  }

  try {
    const response = await handleCommand(message);
    if (response.photoUrl) {
      await sendPhoto(message.chat.id, response.photoUrl, response.text, {
        parse_mode: response.parse_mode
      });
      return;
    }

    await sendMessage(message.chat.id, response.text, {
      parse_mode: response.parse_mode
    });
  } catch (error) {
    console.error("Command handling failed:", error);
    await sendMessage(
      message.chat.id,
      "Something went wrong while talking to OpenDota or Telegram. Check the terminal logs for details."
    );
  }
}

async function main() {
  console.log("Registering Telegram commands...");
  await setCommands(botCommands);

  let offset = 0;
  console.log("Bot is running and polling for updates.");

  while (true) {
    try {
      const updates = await getUpdates(offset);
      for (const update of updates) {
        offset = update.update_id + 1;
        if (update.message?.text?.startsWith("/")) {
          await processMessage(update.message);
        }
      }
    } catch (error) {
      console.error("Polling failed:", error);
    }

    await new Promise((resolve) => {
      setTimeout(resolve, config.pollIntervalMs);
    });
  }
}

main().catch((error) => {
  console.error("Fatal startup error:", error);
  process.exitCode = 1;
});
