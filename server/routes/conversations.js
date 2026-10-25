import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const MESSAGE_LIMIT = 50;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const me = req.user._id;
  const conversations = await Conversation.find({ participants: me })
    .sort({ updatedAt: -1 })
    .populate("participants", "username");

  const withUnread = await Promise.all(
    conversations.map(async (c) => {
      const readAt = c.receiptFor(me)?.readAt ?? new Date(0);
      const unreadCount = await Message.countDocuments({
        conversation: c._id,
        sender: { $ne: me },
        createdAt: { $gt: readAt },
      });
      return { ...c.toClient(), unreadCount };
    }),
  );

  res.json({ conversations: withUnread });
});

router.get("/:id/messages", async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  const isMember = await Conversation.exists({ _id: id, participants: req.user._id });
  if (!isMember) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  const latest = await Message.find({ conversation: id })
    .sort({ createdAt: -1 })
    .limit(MESSAGE_LIMIT)
    .populate("sender", "username");

  res.json({ messages: latest.reverse().map((m) => m.toClient()) });
});

export default router;
