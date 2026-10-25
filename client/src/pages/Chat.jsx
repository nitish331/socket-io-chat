import { useCallback, useEffect, useRef, useState } from "react";
import { socket } from "../socket";
import { authRequest } from "../api";
import { useAuth } from "../auth/useAuth";
import Sidebar from "../components/chat/Sidebar";
import ChatHeader from "../components/chat/ChatHeader";
import MessageList from "../components/chat/MessageList";
import Composer from "../components/chat/Composer";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";
import Logo from "../components/Logo";
import { mergeReceipts, otherParticipant, receiptOf } from "../utils/format";
import "./Chat.css";

const EMPTY_THREAD = {
  conversationId: null,
  items: [],
  loaded: true,
  error: "",
  hasMore: false,
  loadingOlder: false,
  olderError: "",
};

function newThread(conversationId, items = []) {
  return { ...EMPTY_THREAD, conversationId, items, loaded: false };
}
const TYPING_TIMEOUT_MS = 5000;

function upsertConversation(list, conversation) {
  const existing = list.find((c) => c.id === conversation.id);
  const merged = existing
    ? { ...conversation, receipts: mergeReceipts(existing.receipts, conversation.receipts) }
    : conversation;
  return [merged, ...list.filter((c) => c.id !== conversation.id)];
}

function withoutKey(obj, key) {
  if (!obj[key]) return obj;
  const next = { ...obj };
  delete next[key];
  return next;
}

function isPageVisible() {
  return document.visibilityState === "visible";
}

function mergeMessages(fetched, existing) {
  const byId = new Map();
  for (const m of fetched) byId.set(m.id, { type: "message", ...m });
  for (const m of existing) if (!byId.has(m.id)) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function ChatIntro({ person }) {
  return (
    <div className="chat-intro">
      <Avatar name={person.username} size={72} />
      <h2>{person.username}</h2>
      <p>
        This is the beginning of your conversation with <strong>@{person.username}</strong>.
        Messages are delivered instantly.
      </p>
    </div>
  );
}

function EmptyPane({ onNewChat }) {
  return (
    <div className="empty-pane">
      <div className="empty-pane-art">
        <Logo size={64} />
      </div>
      <h2>Relay for web</h2>
      <p>Pick a chat on the left, or search for anyone by username to start a new conversation.</p>
      <button type="button" className="primary-btn" onClick={onNewChat}>
        <Icon name="newChat" size={17} />
        Start a new chat
      </button>
    </div>
  );
}

function Chat() {
  const { user, logout } = useAuth();
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [connectionIssue, setConnectionIssue] = useState("");
  const [conversations, setConversations] = useState([]);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [active, setActive] = useState(null);
  const [thread, setThread] = useState(EMPTY_THREAD);
  const [reloadKey, setReloadKey] = useState(0);
  const [unread, setUnread] = useState({});
  const [presence, setPresence] = useState({});
  const [typingIn, setTypingIn] = useState({});
  const [pageVisible, setPageVisible] = useState(isPageVisible);
  const [replyingTo, setReplyingTo] = useState(null);
  const [notice, setNotice] = useState("");
  const searchRef = useRef(null);
  const activeIdRef = useRef(null);
  const watchedRef = useRef(new Set());
  const lastReadMarkRef = useRef("");
  const loadingOlderRef = useRef(false);

  const watchPresence = useCallback((userIds) => {
    const fresh = userIds.filter((id) => id && !watchedRef.current.has(id));
    if (fresh.length === 0) return;
    fresh.forEach((id) => watchedRef.current.add(id));

    socket.timeout(5000).emit("watch_presence", fresh, (err, response) => {
      if (err || !response?.ok) {
        fresh.forEach((id) => watchedRef.current.delete(id));
        return;
      }
      setPresence((prev) => ({ ...prev, ...response.presence }));
    });
  }, []);

  const activeConversation = active?.conversationId
    ? conversations.find((c) => c.id === active.conversationId)
    : null;
  const activeConversationId = activeConversation?.id ?? null;
  const person = activeConversation
    ? otherParticipant(activeConversation, user.id)
    : (active?.draftUser ?? null);

  useEffect(() => {
    activeIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    const typingTimers = new Map();

    function clearTyping(conversationId) {
      clearTimeout(typingTimers.get(conversationId));
      typingTimers.delete(conversationId);
      setTypingIn((prev) => {
        if (!prev[conversationId]) return prev;
        const next = { ...prev };
        delete next[conversationId];
        return next;
      });
    }

    async function loadConversations() {
      try {
        const data = await authRequest("/api/conversations");
        setConversations(data.conversations);
        setUnread(
          Object.fromEntries(
            data.conversations
              .filter((c) => c.unreadCount > 0)
              .map((c) => [c.id, c.unreadCount]),
          ),
        );

        for (const c of data.conversations) {
          const last = c.lastMessage;
          if (!last || last.senderId === user.id) continue;
          const mine = receiptOf(c, user.id);
          if (!mine?.deliveredAt || new Date(mine.deliveredAt) < new Date(last.createdAt)) {
            socket.emit("mark_delivered", { conversationId: c.id, upTo: last.createdAt });
          }
        }
      } catch (err) {
        if (err.status === 401) logout();
      } finally {
        setConversationsLoaded(true);
      }
    }

    function onConnect() {
      watchedRef.current = new Set();
      setIsConnected(true);
      setConnectionIssue("");
      loadConversations();
      setReloadKey((k) => k + 1);
    }

    function onDisconnect() {
      setIsConnected(false);
      typingTimers.forEach(clearTimeout);
      typingTimers.clear();
      setTypingIn({});
    }

    function onPresence({ userId, online, lastSeen }) {
      setPresence((prev) => ({ ...prev, [userId]: { online, lastSeen } }));
    }

    function onTyping({ conversationId, isTyping }) {
      if (!isTyping) {
        clearTyping(conversationId);
        return;
      }
      clearTimeout(typingTimers.get(conversationId));
      typingTimers.set(
        conversationId,
        setTimeout(() => clearTyping(conversationId), TYPING_TIMEOUT_MS),
      );
      setTypingIn((prev) =>
        prev[conversationId] ? prev : { ...prev, [conversationId]: true },
      );
    }

    function onConnectError(err) {
      if (err.message === "Unauthorized") {
        logout();
      } else {
        setConnectionIssue("Can't reach the chat server. Retrying…");
      }
    }

    function onReceiveMessage({ message, conversation }) {
      setConversations((prev) => upsertConversation(prev, conversation));

      const fromOther = message.sender.id !== user.id;
      const isActive = message.conversationId === activeIdRef.current;
      if (fromOther) clearTyping(message.conversationId);

      if (isActive) {
        setThread((prev) =>
          prev.conversationId === message.conversationId &&
          !prev.items.some((i) => i.id === message.id)
            ? { ...prev, items: [...prev.items, { type: "message", ...message }] }
            : prev,
        );
      }

      if (fromOther && !(isActive && isPageVisible())) {
        setUnread((prev) => ({
          ...prev,
          [message.conversationId]: (prev[message.conversationId] || 0) + 1,
        }));
        socket.emit("mark_delivered", {
          conversationId: message.conversationId,
          upTo: message.createdAt,
        });
      }
    }

    function onMessageUpdated({ message, conversation }) {
      const updated = { type: "message", ...message };

      setThread((prev) => {
        if (prev.conversationId !== message.conversationId) return prev;
        return {
          ...prev,
          items: prev.items.map((i) => {
            if (i.id === message.id) return updated;
            if (message.deleted && i.replyTo?.id === message.id) {
              return { ...i, replyTo: { ...i.replyTo, deleted: true, text: "" } };
            }
            return i;
          }),
        };
      });

      if (message.deleted) {
        setReplyingTo((prev) => (prev?.id === message.id ? null : prev));
      }

      if (conversation) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversation.id
              ? { ...conversation, receipts: mergeReceipts(c.receipts, conversation.receipts) }
              : c,
          ),
        );
      }
    }

    function onReceipt(receipt) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === receipt.conversationId
            ? { ...c, receipts: mergeReceipts(c.receipts, [receipt]) }
            : c,
        ),
      );
      if (receipt.userId === user.id && typeof receipt.unreadCount === "number") {
        setUnread((prev) =>
          receipt.unreadCount > 0
            ? { ...prev, [receipt.conversationId]: receipt.unreadCount }
            : withoutKey(prev, receipt.conversationId),
        );
      }
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("receive_message", onReceiveMessage);
    socket.on("presence", onPresence);
    socket.on("typing", onTyping);
    socket.on("receipt", onReceipt);
    socket.on("message_updated", onMessageUpdated);

    socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("receive_message", onReceiveMessage);
      socket.off("presence", onPresence);
      socket.off("typing", onTyping);
      socket.off("receipt", onReceipt);
      socket.off("message_updated", onMessageUpdated);
      typingTimers.forEach(clearTimeout);
      socket.disconnect();
    };
  }, [logout, user.id]);

  useEffect(() => {
    if (!activeConversationId) return;

    let cancelled = false;
    authRequest(`/api/conversations/${activeConversationId}/messages`)
      .then((data) => {
        if (cancelled) return;
        setThread((prev) =>
          prev.conversationId === activeConversationId
            ? {
                ...prev,
                items: mergeMessages(data.messages, prev.items),
                hasMore: prev.loaded ? prev.hasMore : data.hasMore,
                loaded: true,
                error: "",
              }
            : prev,
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setThread((prev) =>
          prev.conversationId === activeConversationId
            ? { ...prev, loaded: true, error: err.message }
            : prev,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [activeConversationId, reloadKey]);

  const personId = person?.id ?? null;

  useEffect(() => {
    if (!isConnected) return;
    watchPresence(conversations.map((c) => otherParticipant(c, user.id).id));
  }, [isConnected, conversations, user.id, watchPresence]);

  useEffect(() => {
    if (isConnected && personId) watchPresence([personId]);
  }, [isConnected, personId, watchPresence]);

  function sendTyping(isTyping) {
    if (activeConversationId && socket.connected) {
      socket.emit("typing", { conversationId: activeConversationId, isTyping });
    }
  }

  useEffect(() => {
    function onVisibilityChange() {
      setPageVisible(isPageVisible());
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const myReadAt = receiptOf(activeConversation, user.id)?.readAt ?? null;

  useEffect(() => {
    if (!activeConversationId || !pageVisible || !isConnected) return;
    if (thread.conversationId !== activeConversationId) return;

    const latestFromOther = thread.items.findLast(
      (i) => i.type === "message" && i.sender.id !== user.id,
    );
    if (!latestFromOther) return;
    if (myReadAt && new Date(myReadAt) >= new Date(latestFromOther.createdAt)) return;

    const markKey = `${activeConversationId}:${latestFromOther.id}`;
    if (lastReadMarkRef.current === markKey) return;
    lastReadMarkRef.current = markKey;

    socket.emit("mark_read", {
      conversationId: activeConversationId,
      upTo: latestFromOther.createdAt,
    });
  }, [activeConversationId, pageVisible, isConnected, thread, myReadAt, user.id]);

  useEffect(() => {
    const total = Object.values(unread).reduce((sum, n) => sum + n, 0);
    document.title = total > 0 ? `(${total}) Relay` : "Relay";
  }, [unread]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  function emitAction(event, payload) {
    socket.timeout(5000).emit(event, payload, (err, response) => {
      if (err) setNotice("Server didn't respond. Try again.");
      else if (!response?.ok) setNotice(response?.error ?? "Something went wrong");
    });
  }

  function reactToMessage(messageId, emoji) {
    emitAction("react", { messageId, emoji });
  }

  function deleteMessage(messageId) {
    emitAction("delete_message", { messageId });
  }

  function openConversation(id) {
    setReplyingTo(null);
    setActive({ conversationId: id });
    if (thread.conversationId !== id) {
      setThread(newThread(id));
    }
    setUnread((prev) => withoutKey(prev, id));
  }

  async function loadOlder() {
    const conversationId = thread.conversationId;
    const oldest = thread.items.find((i) => i.type === "message");
    if (!conversationId || !oldest || !thread.hasMore || !thread.loaded) return;
    if (loadingOlderRef.current) return;

    loadingOlderRef.current = true;
    setThread((prev) => ({ ...prev, loadingOlder: true, olderError: "" }));

    try {
      const data = await authRequest(
        `/api/conversations/${conversationId}/messages?before=${oldest.id}`,
      );
      setThread((prev) =>
        prev.conversationId === conversationId
          ? {
              ...prev,
              items: mergeMessages(data.messages, prev.items),
              hasMore: data.hasMore,
              loadingOlder: false,
            }
          : prev,
      );
    } catch (err) {
      setThread((prev) =>
        prev.conversationId === conversationId
          ? { ...prev, loadingOlder: false, olderError: err.message }
          : prev,
      );
    } finally {
      loadingOlderRef.current = false;
    }
  }

  function startChat(target) {
    const existing = conversations.find(
      (c) => otherParticipant(c, user.id).id === target.id,
    );
    if (existing) {
      openConversation(existing.id);
      return;
    }
    setReplyingTo(null);
    setActive({ draftUser: target });
    setThread(EMPTY_THREAD);
  }

  function closeChat() {
    setReplyingTo(null);
    setActive(null);
    setThread(EMPTY_THREAD);
  }

  function sendMessage(text) {
    return new Promise((resolve) => {
      const target = active?.conversationId
        ? { conversationId: active.conversationId }
        : { recipientId: active.draftUser.id };
      const replyToId = replyingTo?.id;

      socket
        .timeout(5000)
        .emit("send_message", { ...target, text, replyToId }, (err, response) => {
          if (err) {
            resolve({ ok: false, error: "Server didn't respond. Try again." });
            return;
          }
          if (response.ok) {
            setReplyingTo((prev) => (prev?.id === replyToId ? null : prev));
          }
          if (response.ok && !active.conversationId) {
            const { conversation, message } = response;
            setConversations((prev) => upsertConversation(prev, conversation));
            setActive({ conversationId: conversation.id });
            setThread(newThread(conversation.id, [{ type: "message", ...message }]));
          }
          resolve(response);
        });
    });
  }

  const replyPreview = replyingTo
    ? {
        id: replyingTo.id,
        name: replyingTo.sender.id === user.id ? "yourself" : replyingTo.sender.username,
        text: replyingTo.text,
      }
    : null;

  return (
    <div className={`workspace ${person ? "has-chat" : ""}`}>
      <Sidebar
        conversations={conversations}
        loading={!conversationsLoaded}
        activeKey={activeConversationId}
        unread={unread}
        presence={presence}
        typingIn={typingIn}
        currentUser={user}
        isConnected={isConnected}
        onOpenConversation={openConversation}
        onStartChat={startChat}
        onLogout={logout}
        searchRef={searchRef}
      />

      <main className="conversation">
        {person ? (
          <>
            <ChatHeader
              person={person}
              presence={presence[person.id]}
              typing={Boolean(activeConversationId && typingIn[activeConversationId])}
              isConnected={isConnected}
              onBack={closeChat}
            />

            {!isConnected && (
              <div className="conn-banner" role="status">
                <Icon name="alert" size={16} />
                {connectionIssue || "Connection lost. Reconnecting…"}
              </div>
            )}
            {thread.error && (
              <div className="conn-banner error" role="alert">
                <Icon name="alert" size={16} />
                {thread.error}
              </div>
            )}
            {notice && (
              <div className="conn-banner error" role="alert">
                <Icon name="alert" size={16} />
                {notice}
              </div>
            )}

            <MessageList
              key={`messages-${person.id}`}
              items={thread.items}
              loading={!thread.loaded && thread.items.length === 0}
              currentUserId={user.id}
              otherReceipt={receiptOf(activeConversation, user.id, { other: true })}
              typing={Boolean(activeConversationId && typingIn[activeConversationId])}
              showAuthors={false}
              hasMore={thread.hasMore}
              loadingOlder={thread.loadingOlder}
              olderError={thread.olderError}
              onLoadOlder={loadOlder}
              onReply={setReplyingTo}
              onReact={reactToMessage}
              onDelete={deleteMessage}
              onNotice={setNotice}
              intro={<ChatIntro person={person} />}
            />

            <Composer
              key={`composer-${person.id}`}
              onSend={sendMessage}
              onTyping={activeConversationId ? sendTyping : undefined}
              replyTo={replyPreview}
              onCancelReply={() => setReplyingTo(null)}
              disabled={!isConnected}
              placeholder={isConnected ? `Message ${person.username}` : "Waiting for connection…"}
            />
          </>
        ) : (
          <EmptyPane onNewChat={() => searchRef.current?.focus()} />
        )}
      </main>
    </div>
  );
}

export default Chat;
