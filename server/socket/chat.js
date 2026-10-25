import { isValidObjectId } from "mongoose";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { User } from "../models/User.js";
import { getPresence, presenceRoom, userConnected, userDisconnected } from "./presence.js";

export const userRoom = (userId) => `user:${userId}`;

const MAX_WATCHED_USERS = 200;

async function findOrCreateConversation(userId, recipientId) {
  const key = Conversation.keyFor(userId, recipientId);
  try {
    return await Conversation.findOneAndUpdate(
      { key },
      { $setOnInsert: { key, participants: [userId, recipientId] } },
      { upsert: true, returnDocument: "after" },
    );
  } catch (err) {
    if (err.code === 11000) return Conversation.findOne({ key });
    throw err;
  }
}

async function resolveConversation(user, data) {
  if (data?.conversationId) {
    if (!isValidObjectId(data.conversationId)) return null;
    return Conversation.findOne({ _id: data.conversationId, participants: user.id });
  }

  const recipientId = data?.recipientId;
  if (!isValidObjectId(recipientId) || recipientId === user.id) return null;
  if (!(await User.exists({ _id: recipientId }))) return null;

  return findOrCreateConversation(user.id, recipientId);
}

export function registerChatHandlers(io) {
  io.on("connection", (socket) => {
    const user = socket.data.user;
    console.log(`${user.username} connected (${socket.id})`);

    socket.join(userRoom(user.id));
    userConnected(io, user.id);

    const typingTargets = new Map();

    socket.on("watch_presence", async (userIds, callback) => {
      if (!Array.isArray(userIds)) {
        return callback?.({ ok: false, error: "Expected a list of user ids" });
      }

      const ids = [...new Set(userIds)]
        .filter((id) => isValidObjectId(id) && id !== user.id)
        .slice(0, MAX_WATCHED_USERS);

      socket.join(ids.map(presenceRoom));

      try {
        callback?.({ ok: true, presence: await getPresence(ids) });
      } catch (err) {
        console.error("Failed to load presence:", err.message);
        callback?.({ ok: false, error: "Could not load presence" });
      }
    });

    socket.on("typing", async (data) => {
      const conversationId = data?.conversationId;
      if (!isValidObjectId(conversationId)) return;

      let otherId = typingTargets.get(conversationId);
      if (!otherId) {
        try {
          const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: user.id,
          })
            .select("participants")
            .lean();
          if (!conversation) return;

          otherId = conversation.participants.map(String).find((id) => id !== user.id);
          typingTargets.set(conversationId, otherId);
        } catch (err) {
          console.error("Failed to resolve typing target:", err.message);
          return;
        }
      }

      io.to(userRoom(otherId)).volatile.emit("typing", {
        conversationId,
        userId: user.id,
        isTyping: Boolean(data.isTyping),
      });
    });

    socket.on("send_message", async (data, callback) => {
      const text = typeof data?.text === "string" ? data.text.trim() : "";

      if (!text) {
        return callback?.({ ok: false, error: "Message cannot be empty" });
      }
      if (text.length > 2000) {
        return callback?.({ ok: false, error: "Message is too long" });
      }

      try {
        const conversation = await resolveConversation(user, data);
        if (!conversation) {
          return callback?.({ ok: false, error: "Chat not found" });
        }

        const message = await Message.create({
          conversation: conversation._id,
          sender: user.id,
          text,
        });

        conversation.lastMessage = {
          text,
          sender: user.id,
          createdAt: message.createdAt,
        };
        await conversation.save();

        await message.populate("sender", "username");
        await conversation.populate("participants", "username");

        const payload = {
          message: message.toClient(),
          conversation: conversation.toClient(),
        };

        const [a, b] = conversation.participants.map((p) => p._id.toString());
        io.to(userRoom(a)).to(userRoom(b)).emit("receive_message", payload);

        callback?.({ ok: true, ...payload });
      } catch (err) {
        console.error("Failed to send message:", err.message);
        callback?.({ ok: false, error: "Could not send message" });
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`${user.username} disconnected (${reason})`);
      userDisconnected(io, user.id);
    });
  });
}
