import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { Conversation } from "../models/Conversation.js";
import { Message, MESSAGE_POPULATE } from "../models/Message.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

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

  const limit = Math.min(Math.max(Number(req.query.limit) || PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const filter = { conversation: id };

  const { before } = req.query;
  if (before) {
    const anchor = isValidObjectId(before)
      ? await Message.findOne({ _id: before, conversation: id }).select("createdAt")
      : null;
    if (!anchor) {
      return res.status(400).json({ error: "Invalid 'before' cursor" });
    }
    filter.$or = [
      { createdAt: { $lt: anchor.createdAt } },
      { createdAt: anchor.createdAt, _id: { $lt: anchor._id } },
    ];
  }

  const page = await Message.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .populate(MESSAGE_POPULATE);

  const hasMore = page.length > limit;
  const messages = page.slice(0, limit).reverse();

  res.json({ messages: messages.map((m) => m.toClient()), hasMore });
});

export default router;
