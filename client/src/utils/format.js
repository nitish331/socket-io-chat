const AVATAR_COLORS = [
  "#5b4cf0",
  "#e0457b",
  "#0f9d8a",
  "#e8772e",
  "#2f80ed",
  "#9b51e0",
  "#d4a017",
  "#27ae60",
  "#c0392b",
  "#16a2b8",
];

export function avatarColor(name = "") {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function initials(name = "") {
  const parts = name.split(/[_\s]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isSameDay(a, b) {
  const x = new Date(a);
  const y = new Date(b);
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  );
}

export function listTime(iso) {
  const date = new Date(iso);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);

  if (isSameDay(date, now)) return formatTime(iso);
  if (isSameDay(date, yesterday)) return "Yesterday";
  if (now - date < 6 * 24 * 60 * 60 * 1000) {
    return date.toLocaleDateString([], { weekday: "short" });
  }
  return date.toLocaleDateString([], { day: "numeric", month: "short", year: "2-digit" });
}

export function lastSeenLabel(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);

  if (isSameDay(date, now)) return `last seen today at ${formatTime(iso)}`;
  if (isSameDay(date, yesterday)) return `last seen yesterday at ${formatTime(iso)}`;
  return `last seen ${date.toLocaleDateString([], { day: "numeric", month: "short" })}`;
}

export function receiptOf(conversation, userId, { other = false } = {}) {
  return (
    conversation?.receipts?.find((r) => (other ? r.userId !== userId : r.userId === userId)) ??
    null
  );
}

export function receiptStatus(createdAt, receipt) {
  if (!receipt) return "sent";
  const sentAt = new Date(createdAt).getTime();
  if (receipt.readAt && new Date(receipt.readAt).getTime() >= sentAt) return "read";
  if (receipt.deliveredAt && new Date(receipt.deliveredAt).getTime() >= sentAt) return "delivered";
  return "sent";
}

function later(a, b) {
  if (!a) return b ?? null;
  if (!b) return a;
  return new Date(a) >= new Date(b) ? a : b;
}

export function mergeReceipts(current = [], incoming = []) {
  const byUser = new Map(current.map((r) => [r.userId, r]));
  for (const r of incoming) {
    if (!r?.userId) continue;
    const prev = byUser.get(r.userId);
    byUser.set(r.userId, {
      userId: r.userId,
      deliveredAt: later(prev?.deliveredAt, r.deliveredAt),
      readAt: later(prev?.readAt, r.readAt),
    });
  }
  return [...byUser.values()];
}

export function otherParticipant(conversation, myId) {
  return (
    conversation.participants.find((p) => p.id !== myId) ?? conversation.participants[0]
  );
}

export function isGroup(conversation) {
  return conversation?.type === "group";
}

export function conversationTitle(conversation, myId) {
  if (isGroup(conversation)) return conversation.name;
  return otherParticipant(conversation, myId).username;
}

export function othersReceipts(conversation, myId) {
  if (!conversation) return [];
  const memberIds = new Set(conversation.participants.map((p) => p.id));
  return (conversation.receipts ?? []).filter(
    (r) => r.userId !== myId && memberIds.has(r.userId),
  );
}

const STATUS_RANK = { sent: 0, delivered: 1, read: 2 };

export function groupReceiptStatus(createdAt, receipts) {
  if (!receipts || receipts.length === 0) return "sent";
  let lowest = "read";
  for (const receipt of receipts) {
    const status = receiptStatus(createdAt, receipt);
    if (STATUS_RANK[status] < STATUS_RANK[lowest]) lowest = status;
  }
  return lowest;
}

function nameFor(person, myId, { capital = false } = {}) {
  if (person?.id === myId) return capital ? "You" : "you";
  return person?.username ?? "someone";
}

function joinNames(names) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

export function systemMessageText(message, myId) {
  const event = message.event;
  if (!event) return message.text;

  const actor = nameFor(message.sender, myId, { capital: true });
  const targets = joinNames(event.targets.map((t) => nameFor(t, myId)));

  switch (event.action) {
    case "created":
      return `${actor} created the group "${event.name}"`;
    case "added":
      return `${actor} added ${targets}`;
    case "removed":
      return `${actor} removed ${targets}`;
    case "left":
      return `${actor} left`;
    case "renamed":
      return `${actor} changed the group name to "${event.name}"`;
    case "promoted": {
      const who = nameFor(event.targets[0], myId, { capital: true });
      return who === "You" ? "You're now an admin" : `${who} is now an admin`;
    }
    default:
      return message.text;
  }
}

export function typingLabel(names) {
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return `${names.length} people are typing…`;
}

export function memberSummary(conversation, myId) {
  const others = conversation.participants
    .filter((p) => p.id !== myId)
    .map((p) => p.username)
    .sort();
  const inGroup = conversation.participants.some((p) => p.id === myId);
  return [...(inGroup ? ["You"] : []), ...others].join(", ");
}

export function dayLabel(iso) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";

  return date.toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}
