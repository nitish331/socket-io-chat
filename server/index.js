import dotenv from "dotenv";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { connectDB } from "./config/db.js";
import { Message } from "./models/Message.js";

dotenv.config({ quiet: true });

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const HISTORY_LIMIT = 50;

const app = express();
app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Chat server is running");
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: CLIENT_URL },
});

io.on("connection", async (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.broadcast.emit("user_joined", { userId: socket.id });

  socket.on("send_message", async (data, callback) => {
    const text = typeof data?.text === "string" ? data.text.trim() : "";

    if (!text) {
      return callback?.({ ok: false, error: "Message cannot be empty" });
    }
    if (text.length > 2000) {
      return callback?.({ ok: false, error: "Message is too long" });
    }

    try {
      const saved = await Message.create({ text, senderId: socket.id });
      io.emit("receive_message", saved.toClient());
      callback?.({ ok: true });
    } catch (err) {
      console.error("Failed to save message:", err.message);
      callback?.({ ok: false, error: "Could not save message" });
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`User disconnected: ${socket.id} (${reason})`);
    socket.broadcast.emit("user_left", { userId: socket.id });
  });

  try {
    const latest = await Message.find()
      .sort({ createdAt: -1 })
      .limit(HISTORY_LIMIT);
    socket.emit(
      "message_history",
      latest.reverse().map((m) => m.toClient()),
    );
  } catch (err) {
    console.error("Failed to load history:", err.message);
  }

  socket.emit("welcome", {
    message: "Welcome to the chat server!",
  });
});

async function start() {
  try {
    await connectDB(process.env.MONGO_URI);
    httpServer.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
}

start();
