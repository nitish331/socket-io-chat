import mongoose from "mongoose";

export const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    text: {
      type: String,
      required() {
        return !this.deletedAt;
      },
      trim: true,
      maxlength: 2000,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    reactions: [
      {
        _id: false,
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        emoji: { type: String, enum: REACTIONS, required: true },
      },
    ],
  },
  { timestamps: true },
);

messageSchema.index({ conversation: 1, createdAt: -1, _id: -1 });

export const MESSAGE_POPULATE = [
  { path: "sender", select: "username" },
  {
    path: "replyTo",
    select: "text sender deletedAt",
    populate: { path: "sender", select: "username" },
  },
];

function senderToClient(sender) {
  return sender?.username
    ? { id: sender._id.toString(), username: sender.username }
    : { id: null, username: "deleted user" };
}

function replyToClient(original) {
  if (!original) return null;
  if (!original._id) return { id: original.toString(), sender: null, text: "", deleted: true };

  return {
    id: original._id.toString(),
    sender: senderToClient(original.sender),
    text: original.deletedAt ? "" : original.text.slice(0, 200),
    deleted: Boolean(original.deletedAt),
  };
}

messageSchema.methods.toClient = function () {
  const base = {
    id: this._id.toString(),
    conversationId: this.conversation.toString(),
    sender: senderToClient(this.sender),
    createdAt: this.createdAt.toISOString(),
  };

  if (this.deletedAt) {
    return { ...base, deleted: true, text: "", replyTo: null, reactions: [] };
  }

  return {
    ...base,
    deleted: false,
    text: this.text,
    replyTo: replyToClient(this.replyTo),
    reactions: this.reactions.map((r) => ({ userId: r.user.toString(), emoji: r.emoji })),
  };
};

export const Message = mongoose.model("Message", messageSchema);
