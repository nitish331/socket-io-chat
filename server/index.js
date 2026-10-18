import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { randomUUID } from "crypto";

const PORT = 5000;
const CLIENT_URL = "http://localhost:5173";

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

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.emit("welcome", {
    message: "Welcome to the chat server!",
  });

  socket.broadcast.emit("user_joined", { userId: socket.id });

  socket.on("send_message", (data, callback) => {
    const text = typeof data?.text === "string" ? data.text.trim() : "";

    if (!text) {
      return callback?.({ ok: false, error: "Message cannot be empty" });
    }
    if (text.length > 2000) {
      return callback?.({ ok: false, error: "Message is too long" });
    }

    const message = {
      id: randomUUID(),
      text,
      senderId: socket.id,
      createdAt: new Date().toISOString(),
    };

    io.emit("receive_message", message);
    callback?.({ ok: true });
  });

  socket.on("disconnect", (reason) => {
    console.log(`User disconnected: ${socket.id} (${reason})`);
    socket.broadcast.emit("user_left", { userId: socket.id });
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
