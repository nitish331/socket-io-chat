import { Conversation } from "../models/Conversation.js";

const TTL_MS = 30_000;
const cache = new Map();

export async function getConversationMembers(conversationId) {
  const key = String(conversationId);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.memberIds;

  const conversation = await Conversation.findById(key).select("participants").lean();
  if (!conversation) {
    cache.delete(key);
    return null;
  }

  const memberIds = conversation.participants.map(String);
  cache.set(key, { memberIds, expiresAt: Date.now() + TTL_MS });
  return memberIds;
}

export function forgetConversationMembers(conversationId) {
  cache.delete(String(conversationId));
}
