import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 20,
      match: /^[a-z0-9_]+$/,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    lastSeen: {
      type: Date,
    },
  },
  { timestamps: true },
);

userSchema.methods.toClient = function () {
  return {
    id: this._id.toString(),
    username: this.username,
    createdAt: this.createdAt.toISOString(),
  };
};

export const User = mongoose.model("User", userSchema);
