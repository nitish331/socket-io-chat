import { Router } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { signToken } from "../utils/token.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const USERNAME_RULE = /^[a-z0-9_]{3,20}$/;

function readCredentials(body) {
  const username =
    typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  return { username, password };
}

router.post("/register", async (req, res) => {
  const { username, password } = readCredentials(req.body);

  if (!USERNAME_RULE.test(username)) {
    return res.status(400).json({
      error:
        "Username must be 3-20 characters: lowercase letters, numbers or _",
    });
  }
  if (password.length < 6 || password.length > 72) {
    return res
      .status(400)
      .json({ error: "Password must be between 6 and 72 characters" });
  }

  if (await User.exists({ username })) {
    return res.status(409).json({ error: "Username is already taken" });
  }

  const hashed = await bcrypt.hash(password, 10);

  try {
    const user = await User.create({ username, password: hashed });
    res.status(201).json({ token: signToken(user), user: user.toClient() });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Username is already taken" });
    }
    throw err;
  }
});

router.post("/login", async (req, res) => {
  const { username, password } = readCredentials(req.body);

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  }

  const user = await User.findOne({ username }).select("+password");
  const valid = user && (await bcrypt.compare(password, user.password));

  if (!valid) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  res.json({ token: signToken(user), user: user.toClient() });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user.toClient() });
});

export default router;
