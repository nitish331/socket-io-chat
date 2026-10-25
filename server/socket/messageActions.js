import { isValidObjectId } from "mongoose";
import { Conversation } from "../models/Conversation.js";
import { Message, MESSAGE_POPULATE, REACTIONS } from "../models/Message.js";
import { participantRooms } from "./rooms.js";

async function findMessageForUser(messageId, userId) {
  if (!isValidObjectId(messageId)) return null;

  const message = await Message.findById(messageId).select("conversation sender deletedAt createdAt");
  if (!message) return null;

  const conversation = await Conversation.findOne({
    _id: message.conversation,
    participants: userId,
  });
  if (!conversation) return null;

  return { message, conversation };
}

async function broadcastUpdate(io, conversation, messageId, { conversationChanged = false } = {}) {
  const message = await Message.findById(messageId).populate(MESSAGE_POPULATE);
  const payload = { message: message.toClient() };

  if (conversationChanged) {
    const fresh = await Conversation.findById(conversation._id).populate("participants", "username");
    payload.conversation = fresh.toClient();
  }

  io.to(participantRooms(conversation)).emit("message_updated", payload);
}

export function registerMessageActions(io, socket) {
  const user = socket.data.user;

  socket.on("react", async (data, callback) => {
    const emoji = data?.emoji;
    if (!REACTIONS.includes(emoji)) {
      return callback?.({ ok: false, error: "That reaction isn't supported" });
    }

    try {
      const found = await findMessageForUser(data?.messageId, user.id);
      if (!found) return callback?.({ ok: false, error: "Message not found" });

      const { message, conversation } = found;
      if (message.deletedAt) {
        return callback?.({ ok: false, error: "You can't react to a deleted message" });
      }

      const current = await Message.findOne(
        { _id: message._id, "reactions.user": user.id },
        { "reactions.$": 1 },
      );
      const sameEmoji = current?.reactions[0]?.emoji === emoji;

      await Message.updateOne({ _id: message._id }, { $pull: { reactions: { user: user.id } } });
      if (!sameEmoji) {
        await Message.updateOne(
          { _id: message._id, deletedAt: null },
          { $push: { reactions: { user: user.id, emoji } } },
        );
      }

      await broadcastUpdate(io, conversation, message._id);
      callback?.({ ok: true });
    } catch (err) {
      console.error("Failed to react:", err.message);
      callback?.({ ok: false, error: "Could not add reaction" });
    }
  });

  socket.on("delete_message", async (data, callback) => {
    try {
      const found = await findMessageForUser(data?.messageId, user.id);
      if (!found) return callback?.({ ok: false, error: "Message not found" });

      const { message, conversation } = found;
      if (message.sender.toString() !== user.id) {
        return callback?.({ ok: false, error: "You can only delete your own messages" });
      }
      if (message.deletedAt) return callback?.({ ok: true });

      await Message.updateOne(
        { _id: message._id, sender: user.id, deletedAt: null },
        { $set: { deletedAt: new Date(), text: "", reactions: [] } },
      );

      const wasLastMessage =
        conversation.lastMessage?.createdAt?.getTime() === message.createdAt.getTime() &&
        String(conversation.lastMessage.sender) === user.id;

      if (wasLastMessage) {
        await Conversation.updateOne(
          { _id: conversation._id },
          { $set: { "lastMessage.text": "", "lastMessage.deleted": true } },
          { timestamps: false },
        );
      }

      await broadcastUpdate(io, conversation, message._id, { conversationChanged: wasLastMessage });
      callback?.({ ok: true });
    } catch (err) {
      console.error("Failed to delete message:", err.message);
      callback?.({ ok: false, error: "Could not delete message" });
    }
  });
}
