import mongoose from "mongoose";

export const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export const SYSTEM_ACTIONS = ["created", "added", "removed", "left", "renamed", "promoted"];

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    kind: {
      type: String,
      enum: ["text", "system"],
      default: "text",
    },
    event: {
      type: new mongoose.Schema(
        {
          action: { type: String, enum: SYSTEM_ACTIONS, required: true },
          targets: [
            {
              _id: false,
              id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
              username: String,
            },
          ],
          name: String,
        },
        { _id: false },
      ),
      default: null,
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
    kind: this.kind ?? "text",
    sender: senderToClient(this.sender),
    createdAt: this.createdAt.toISOString(),
  };

  if (this.kind === "system") {
    return {
      ...base,
      deleted: false,
      text: this.text,
      event: {
        action: this.event.action,
        targets: this.event.targets.map((t) => ({ id: t.id.toString(), username: t.username })),
        name: this.event.name ?? null,
      },
      replyTo: null,
      reactions: [],
    };
  }

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
