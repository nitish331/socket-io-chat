import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    senderId: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

messageSchema.index({ createdAt: -1 });

messageSchema.methods.toClient = function () {
  return {
    id: this._id.toString(),
    text: this.text,
    senderId: this.senderId,
    createdAt: this.createdAt.toISOString(),
  };
};

export const Message = mongoose.model("Message", messageSchema);
