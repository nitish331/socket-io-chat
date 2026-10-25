import { Conversation, receiptToClient } from "../models/Conversation.js";

function clampToNow(value) {
  const now = new Date();
  const date = value ? new Date(value) : now;
  if (Number.isNaN(date.getTime()) || date > now) return now;
  return date;
}

export async function advanceReceipt(conversationId, userId, { delivered, read }) {
  const at = clampToNow(read ?? delivered);
  const fields = { deliveredAt: at };
  if (read) fields.readAt = at;

  const max = {};
  for (const [field, value] of Object.entries(fields)) max[`receipts.$.${field}`] = value;

  let conversation = await Conversation.findOneAndUpdate(
    { _id: conversationId, participants: userId, "receipts.user": userId },
    { $max: max },
    { returnDocument: "after", timestamps: false },
  );

  if (!conversation) {
    conversation = await Conversation.findOneAndUpdate(
      { _id: conversationId, participants: userId, "receipts.user": { $ne: userId } },
      { $push: { receipts: { user: userId, deliveredAt: at, readAt: read ? at : null } } },
      { returnDocument: "after", timestamps: false },
    );
  }

  if (!conversation) return null;

  return {
    conversationId: conversation._id.toString(),
    participantIds: conversation.participants.map(String),
    receipt: receiptToClient(conversation.receiptFor(userId)),
  };
}
