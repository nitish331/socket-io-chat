import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

messageSchema.index({ conversation: 1, createdAt: -1 });

messageSchema.methods.toClient = function () {
  const sender = this.sender?.username
    ? { id: this.sender._id.toString(), username: this.sender.username }
    : { id: null, username: "deleted user" };

  return {
    id: this._id.toString(),
    conversationId: this.conversation.toString(),
    text: this.text,
    sender,
    createdAt: this.createdAt.toISOString(),
  };
};

export const Message = mongoose.model("Message", messageSchema);
