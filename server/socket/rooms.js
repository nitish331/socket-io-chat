export const userRoom = (userId) => `user:${userId}`;

export function participantRooms(conversation) {
  return conversation.participants.map((p) => userRoom(String(p._id ?? p)));
}
