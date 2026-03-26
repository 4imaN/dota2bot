import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const dataDir = path.resolve(process.cwd(), "data");
const usersPath = path.join(dataDir, "users.json");

async function ensureDataDir() {
  await mkdir(dataDir, { recursive: true });
}

async function readUsers() {
  await ensureDataDir();

  try {
    const raw = await readFile(usersPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeUsers(users) {
  await ensureDataDir();
  await writeFile(usersPath, `${JSON.stringify(users, null, 2)}\n`, "utf8");
}

export async function getLinkedUser(telegramUserId) {
  const users = await readUsers();
  return users.find((entry) => entry.telegramUserId === telegramUserId) || null;
}

export async function linkUserAccount({ telegramUserId, chatId, username, firstName, accountId }) {
  const users = await readUsers();
  const now = new Date().toISOString();
  const existingIndex = users.findIndex((entry) => entry.telegramUserId === telegramUserId);

  const nextRecord = {
    telegramUserId,
    chatId,
    username: username || "",
    firstName: firstName || "",
    accountId,
    updatedAt: now
  };

  if (existingIndex >= 0) {
    users[existingIndex] = {
      ...users[existingIndex],
      ...nextRecord
    };
  } else {
    users.push({
      ...nextRecord,
      createdAt: now
    });
  }

  await writeUsers(users);
  return nextRecord;
}

export async function unlinkUserAccount(telegramUserId) {
  const users = await readUsers();
  const filtered = users.filter((entry) => entry.telegramUserId !== telegramUserId);
  const removed = filtered.length !== users.length;

  if (removed) {
    await writeUsers(filtered);
  }

  return removed;
}
