import mongoose from "mongoose";

export const MAX_GROUP_MEMBERS = 50;
export const MAX_GROUP_NAME = 50;

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["direct", "group"],
      default: "direct",
    },
    name: {
      type: String,
      trim: true,
      maxlength: MAX_GROUP_NAME,
    },
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      validate: {
        validator(v) {
          return this.type === "group"
            ? v.length >= 1 && v.length <= MAX_GROUP_MEMBERS
            : v.length === 2;
        },
        message: "Invalid number of participants",
      },
      required: true,
    },
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
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
      kind: { type: String, default: "text" },
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

conversationSchema.statics.groupKey = function (conversationId) {
  return `group:${conversationId}`;
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

conversationSchema.methods.isAdmin = function (userId) {
  return (this.admins ?? []).some((a) => String(a._id ?? a) === String(userId));
};

conversationSchema.methods.hasMember = function (userId) {
  return this.participants.some((p) => String(p._id ?? p) === String(userId));
};

conversationSchema.methods.toClient = function () {
  return {
    id: this._id.toString(),
    type: this.type ?? "direct",
    name: this.type === "group" ? this.name : null,
    admins: (this.admins ?? []).map((a) => String(a._id ?? a)),
    createdBy: this.createdBy ? String(this.createdBy) : null,
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
          kind: this.lastMessage.kind ?? "text",
        }
      : null,
    receipts: this.receipts.map(receiptToClient),
    updatedAt: this.updatedAt.toISOString(),
  };
};

export const Conversation = mongoose.model("Conversation", conversationSchema);
