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
    },
  },
  { timestamps: true },
);

conversationSchema.index({ participants: 1, updatedAt: -1 });

conversationSchema.statics.keyFor = function (userA, userB) {
  return [String(userA), String(userB)].sort().join(":");
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
          text: this.lastMessage.text,
          senderId: this.lastMessage.sender.toString(),
          createdAt: this.lastMessage.createdAt.toISOString(),
        }
      : null,
    updatedAt: this.updatedAt.toISOString(),
  };
};

export const Conversation = mongoose.model("Conversation", conversationSchema);
