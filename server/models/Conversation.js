import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      validate: (v) => v.length === 2,
      required: true,
    },
    key: {
      type: String,
      required: true,
      unique: true,
    },
    lastMessage: {
      text: String,
      sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      createdAt: Date,
      deleted: { type: Boolean, default: false },
    },
    receipts: [
      {
        _id: false,
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        deliveredAt: { type: Date, default: null },
        readAt: { type: Date, default: null },
      },
    ],
  },
  { timestamps: true },
);

conversationSchema.index({ participants: 1, updatedAt: -1 });

conversationSchema.statics.keyFor = function (userA, userB) {
  return [String(userA), String(userB)].sort().join(":");
};

export function receiptToClient(receipt) {
  return {
    userId: receipt.user.toString(),
    deliveredAt: receipt.deliveredAt?.toISOString() ?? null,
    readAt: receipt.readAt?.toISOString() ?? null,
  };
}

conversationSchema.methods.receiptFor = function (userId) {
  return this.receipts.find((r) => r.user.toString() === String(userId)) ?? null;
};

conversationSchema.methods.toClient = function () {
  return {
    id: this._id.toString(),
    participants: this.participants.map((p) => ({
      id: p._id.toString(),
      username: p.username,
    })),
    lastMessage: this.lastMessage?.createdAt
      ? {
          text: this.lastMessage.deleted ? "" : this.lastMessage.text,
          senderId: this.lastMessage.sender.toString(),
          createdAt: this.lastMessage.createdAt.toISOString(),
          deleted: Boolean(this.lastMessage.deleted),
        }
      : null,
    receipts: this.receipts.map(receiptToClient),
    updatedAt: this.updatedAt.toISOString(),
  };
};

export const Conversation = mongoose.model("Conversation", conversationSchema);
