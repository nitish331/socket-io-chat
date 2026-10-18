import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

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

  socket.on("disconnect", (reason) => {
    console.log(`User disconnected: ${socket.id} (${reason})`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
