import { Message } from "../models/Message.js";

const HISTORY_LIMIT = 50;

export function registerChatHandlers(io) {
  io.on("connection", async (socket) => {
    const user = socket.data.user;
    console.log(`${user.username} connected (${socket.id})`);

    socket.broadcast.emit("user_joined", { username: user.username });

    socket.on("send_message", async (data, callback) => {
      const text = typeof data?.text === "string" ? data.text.trim() : "";

      if (!text) {
        return callback?.({ ok: false, error: "Message cannot be empty" });
      }
      if (text.length > 2000) {
        return callback?.({ ok: false, error: "Message is too long" });
      }

      try {
        const saved = await Message.create({ text, sender: user.id });
        await saved.populate("sender", "username");
        io.emit("receive_message", saved.toClient());
        callback?.({ ok: true });
      } catch (err) {
        console.error("Failed to save message:", err.message);
        callback?.({ ok: false, error: "Could not save message" });
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`${user.username} disconnected (${reason})`);
      socket.broadcast.emit("user_left", { username: user.username });
    });

    try {
      const latest = await Message.find()
        .sort({ createdAt: -1 })
        .limit(HISTORY_LIMIT)
        .populate("sender", "username");
      socket.emit(
        "message_history",
        latest.reverse().map((m) => m.toClient()),
      );
    } catch (err) {
      console.error("Failed to load history:", err.message);
    }

    socket.emit("welcome", {
      message: `Welcome to the chat, ${user.username}!`,
    });
  });
}
