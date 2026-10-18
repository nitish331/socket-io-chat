import { Router } from "express";
import { User } from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

router.get("/search", requireAuth, async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
  if (!q) return res.json({ users: [] });

  const users = await User.find({
    _id: { $ne: req.user._id },
    username: { $regex: escapeRegex(q.slice(0, 20)) },
  })
    .sort({ username: 1 })
    .limit(20);

  res.json({ users: users.map((u) => ({ id: u._id.toString(), username: u.username })) });
});

export default router;
