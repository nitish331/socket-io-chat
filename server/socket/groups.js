import { isValidObjectId, Types } from "mongoose";
import { Conversation, MAX_GROUP_MEMBERS, MAX_GROUP_NAME } from "../models/Conversation.js";
import { Message, MESSAGE_POPULATE } from "../models/Message.js";
import { User } from "../models/User.js";
import { participantRooms, userRoom } from "./rooms.js";
import { forgetConversationMembers } from "./typingTargets.js";

function cleanName(raw) {
  const name = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  return name.length >= 1 && name.length <= MAX_GROUP_NAME ? name : null;
}

function cleanIds(raw, excludeId) {
  if (!Array.isArray(raw)) return null;
  const ids = [...new Set(raw.map(String))];
  if (ids.some((id) => !isValidObjectId(id))) return null;
  return ids.filter((id) => id !== excludeId);
}

async function findUsers(ids) {
  const users = await User.find({ _id: { $in: ids } }).select("username");
  return users.length === ids.length ? users : null;
}

function toTarget(u) {
  return { id: u._id, username: u.username };
}

function listNames(users) {
  return users.map((u) => u.username).join(", ");
}

async function loadGroup(conversationId, userId) {
  if (!isValidObjectId(conversationId)) return null;
  return Conversation.findOne({ _id: conversationId, type: "group", participants: userId });
}

async function postSystemMessage(io, conversationId, actorId, event, text) {
  const message = await Message.create({
    conversation: conversationId,
    sender: actorId,
    kind: "system",
    event,
    text,
  });

  const conversation = await Conversation.findByIdAndUpdate(
    conversationId,
    {
      $set: {
        lastMessage: {
          text,
          sender: actorId,
          createdAt: message.createdAt,
          deleted: false,
          kind: "system",
        },
      },
    },
    { returnDocument: "after" },
  ).populate("participants", "username");

  await message.populate(MESSAGE_POPULATE);

  const payload = { message: message.toClient(), conversation: conversation.toClient() };
  io.to(participantRooms(conversation)).emit("receive_message", payload);
  return payload;
}

function withAck(name, fn) {
  return async (data, callback) => {
    const reply = typeof callback === "function" ? callback : () => {};
    try {
      reply(await fn(data ?? {}));
    } catch (err) {
      console.error(`${name} failed:`, err.message);
      reply({ ok: false, error: "Something went wrong. Try again." });
    }
  };
}

export function registerGroupHandlers(io, socket) {
  const user = socket.data.user;

  socket.on(
    "create_group",
    withAck("create_group", async ({ name: rawName, memberIds }) => {
      const name = cleanName(rawName);
      if (!name) return { ok: false, error: `Group name must be 1-${MAX_GROUP_NAME} characters` };

      const ids = cleanIds(memberIds, user.id);
      if (!ids || ids.length === 0) return { ok: false, error: "Pick at least one member" };
      if (ids.length + 1 > MAX_GROUP_MEMBERS) {
        return { ok: false, error: `Groups can have at most ${MAX_GROUP_MEMBERS} members` };
      }

      const members = await findUsers(ids);
      if (!members) return { ok: false, error: "Some of those people couldn't be found" };

      const _id = new Types.ObjectId();
      const everyone = [user.id, ...ids];
      await Conversation.create({
        _id,
        type: "group",
        key: Conversation.groupKey(_id),
        name,
        participants: everyone,
        admins: [user.id],
        createdBy: user.id,
        receipts: everyone.map((id) => ({ user: id })),
      });

      const { conversation } = await postSystemMessage(
        io,
        _id,
        user.id,
        { action: "created", targets: [], name },
        `${user.username} created the group "${name}"`,
      );
      return { ok: true, conversation };
    }),
  );

  socket.on(
    "add_members",
    withAck("add_members", async ({ conversationId, memberIds }) => {
      const group = await loadGroup(conversationId, user.id);
      if (!group) return { ok: false, error: "Group not found" };
      if (!group.isAdmin(user.id)) return { ok: false, error: "Only admins can add members" };

      const ids = cleanIds(memberIds, user.id);
      if (!ids) return { ok: false, error: "Invalid member list" };

      const newIds = ids.filter((id) => !group.hasMember(id));
      if (newIds.length === 0) return { ok: false, error: "They're already in the group" };
      if (group.participants.length + newIds.length > MAX_GROUP_MEMBERS) {
        return { ok: false, error: `Groups can have at most ${MAX_GROUP_MEMBERS} members` };
      }

      const added = await findUsers(newIds);
      if (!added) return { ok: false, error: "Some of those people couldn't be found" };

      const joinedAt = new Date();
      await Conversation.updateOne(
        { _id: group._id, type: "group" },
        {
          $addToSet: { participants: { $each: newIds } },
          $push: {
            receipts: {
              $each: newIds.map((id) => ({ user: id, deliveredAt: joinedAt, readAt: joinedAt })),
            },
          },
        },
      );
      forgetConversationMembers(group._id);

      await postSystemMessage(
        io,
        group._id,
        user.id,
        { action: "added", targets: added.map(toTarget) },
        `${user.username} added ${listNames(added)}`,
      );
      return { ok: true };
    }),
  );

  socket.on(
    "remove_member",
    withAck("remove_member", async ({ conversationId, userId: targetId }) => {
      const group = await loadGroup(conversationId, user.id);
      if (!group) return { ok: false, error: "Group not found" };
      if (!group.isAdmin(user.id)) return { ok: false, error: "Only admins can remove members" };
      if (!isValidObjectId(targetId)) return { ok: false, error: "Invalid member" };
      if (String(targetId) === user.id) {
        return { ok: false, error: 'Use "Leave group" to remove yourself' };
      }
      if (!group.hasMember(targetId)) return { ok: false, error: "They're not in this group" };

      const target = await User.findById(targetId).select("username");

      await Conversation.updateOne(
        { _id: group._id },
        { $pull: { participants: targetId, admins: targetId, receipts: { user: targetId } } },
      );
      forgetConversationMembers(group._id);
      io.to(userRoom(String(targetId))).emit("conversation_removed", {
        conversationId: group._id.toString(),
        reason: "removed",
      });

      const targets = target ? [toTarget(target)] : [];
      await postSystemMessage(
        io,
        group._id,
        user.id,
        { action: "removed", targets },
        `${user.username} removed ${target?.username ?? "a member"}`,
      );
      return { ok: true };
    }),
  );

  socket.on(
    "leave_group",
    withAck("leave_group", async ({ conversationId }) => {
      const group = await loadGroup(conversationId, user.id);
      if (!group) return { ok: false, error: "Group not found" };

      await Conversation.updateOne(
        { _id: group._id },
        { $pull: { participants: user.id, admins: user.id, receipts: { user: user.id } } },
      );
      forgetConversationMembers(group._id);
      io.to(userRoom(user.id)).emit("conversation_removed", {
        conversationId: group._id.toString(),
        reason: "left",
      });

      const remaining = await Conversation.findById(group._id).select("participants admins");
      if (remaining.participants.length === 0) {
        await Message.deleteMany({ conversation: group._id });
        await Conversation.deleteOne({ _id: group._id });
        return { ok: true };
      }

      await postSystemMessage(
        io,
        group._id,
        user.id,
        { action: "left", targets: [] },
        `${user.username} left`,
      );

      if (remaining.admins.length === 0) {
        const heirId = remaining.participants[0];
        await Conversation.updateOne({ _id: group._id }, { $addToSet: { admins: heirId } });
        const heir = await User.findById(heirId).select("username");
        await postSystemMessage(
          io,
          group._id,
          heirId,
          { action: "promoted", targets: heir ? [toTarget(heir)] : [] },
          `${heir?.username ?? "A member"} is now an admin`,
        );
      }
      return { ok: true };
    }),
  );

  socket.on(
    "rename_group",
    withAck("rename_group", async ({ conversationId, name: rawName }) => {
      const group = await loadGroup(conversationId, user.id);
      if (!group) return { ok: false, error: "Group not found" };
      if (!group.isAdmin(user.id)) return { ok: false, error: "Only admins can rename the group" };

      const name = cleanName(rawName);
      if (!name) return { ok: false, error: `Group name must be 1-${MAX_GROUP_NAME} characters` };
      if (name === group.name) return { ok: true };

      await Conversation.updateOne({ _id: group._id }, { $set: { name } });
      await postSystemMessage(
        io,
        group._id,
        user.id,
        { action: "renamed", targets: [], name },
        `${user.username} changed the group name to "${name}"`,
      );
      return { ok: true };
    }),
  );
}
