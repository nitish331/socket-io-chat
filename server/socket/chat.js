import { isValidObjectId } from "mongoose";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { User } from "../models/User.js";

export const userRoom = (userId) => `user:${userId}`;

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
    });
  });
}
