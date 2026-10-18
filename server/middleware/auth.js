import { User } from "../models/User.js";
import { verifyToken } from "../utils/token.js";

async function findUserByToken(token) {
  if (!token) return null;
  try {
    const payload = verifyToken(token);
    return await User.findById(payload.sub);
  } catch {
    return null;
  }
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  const user = await findUserByToken(token);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  req.user = user;
  next();
}

export async function socketAuth(socket, next) {
  const user = await findUserByToken(socket.handshake.auth?.token);
  if (!user) {
    return next(new Error("Unauthorized"));
  }

  socket.data.user = { id: user._id.toString(), username: user.username };
  next();
}
