import { User } from "../models/User.js";

const OFFLINE_GRACE_MS = 3000;

const openSockets = new Map();
const offlineTimers = new Map();

export const presenceRoom = (userId) => `presence:${userId}`;

export function isOnline(userId) {
  return openSockets.has(userId) || offlineTimers.has(userId);
}

export function userConnected(io, userId) {
  const count = (openSockets.get(userId) || 0) + 1;
  openSockets.set(userId, count);

  const pending = offlineTimers.get(userId);
  if (pending) {
    clearTimeout(pending);
    offlineTimers.delete(userId);
    return;
  }

  if (count === 1) {
    io.to(presenceRoom(userId)).emit("presence", { userId, online: true, lastSeen: null });
  }
}

export function userDisconnected(io, userId) {
  const count = (openSockets.get(userId) || 1) - 1;
  if (count > 0) {
    openSockets.set(userId, count);
    return;
  }
  openSockets.delete(userId);

  const timer = setTimeout(async () => {
    offlineTimers.delete(userId);
    if (openSockets.has(userId)) return;

    const lastSeen = new Date();
    try {
      await User.updateOne({ _id: userId }, { lastSeen });
    } catch (err) {
      console.error("Failed to save lastSeen:", err.message);
    }
    io.to(presenceRoom(userId)).emit("presence", {
      userId,
      online: false,
      lastSeen: lastSeen.toISOString(),
    });
  }, OFFLINE_GRACE_MS);

  offlineTimers.set(userId, timer);
}

export async function getPresence(userIds) {
  const offline = userIds.filter((id) => !isOnline(id));
  const users = offline.length
    ? await User.find({ _id: { $in: offline } }).select("lastSeen")
    : [];

  const presence = {};
  for (const id of userIds) presence[id] = { online: isOnline(id), lastSeen: null };
  for (const u of users) {
    presence[u._id.toString()].lastSeen = u.lastSeen?.toISOString() ?? null;
  }
  return presence;
}
