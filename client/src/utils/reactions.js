export const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export function groupReactions(reactions = [], myId) {
  const groups = new Map();
  for (const { userId, emoji } of reactions) {
    const group = groups.get(emoji) ?? { emoji, count: 0, mine: false };
    group.count += 1;
    if (userId === myId) group.mine = true;
    groups.set(emoji, group);
  }
  return REACTIONS.filter((e) => groups.has(e)).map((e) => groups.get(e));
}

export function myReaction(reactions = [], myId) {
  return reactions.find((r) => r.userId === myId)?.emoji ?? null;
}
