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
import { otherParticipant } from "../utils/format";
import "./Chat.css";

const EMPTY_THREAD = { conversationId: null, items: [], loaded: true, error: "" };
const TYPING_TIMEOUT_MS = 5000;

function upsertConversation(list, conversation) {
  return [conversation, ...list.filter((c) => c.id !== conversation.id)];
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
  const searchRef = useRef(null);
  const activeIdRef = useRef(null);
  const watchedRef = useRef(new Set());

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
      if (message.sender.id !== user.id) clearTyping(message.conversationId);

      if (message.conversationId === activeIdRef.current) {
        setThread((prev) =>
          prev.conversationId === message.conversationId &&
          !prev.items.some((i) => i.id === message.id)
            ? { ...prev, items: [...prev.items, { type: "message", ...message }] }
            : prev,
        );
      } else if (message.sender.id !== user.id) {
        setUnread((prev) => ({
          ...prev,
          [message.conversationId]: (prev[message.conversationId] || 0) + 1,
        }));
      }
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("receive_message", onReceiveMessage);
    socket.on("presence", onPresence);
    socket.on("typing", onTyping);

    socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("receive_message", onReceiveMessage);
      socket.off("presence", onPresence);
      socket.off("typing", onTyping);
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
            ? { ...prev, items: mergeMessages(data.messages, prev.items), loaded: true, error: "" }
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

  const sendTyping = useCallback(
    (isTyping) => {
      if (activeConversationId && socket.connected) {
        socket.emit("typing", { conversationId: activeConversationId, isTyping });
      }
    },
    [activeConversationId],
  );

  useEffect(() => {
    const total = Object.values(unread).reduce((sum, n) => sum + n, 0);
    document.title = total > 0 ? `(${total}) Relay` : "Relay";
  }, [unread]);

  function openConversation(id) {
    setActive({ conversationId: id });
    if (thread.conversationId !== id) {
      setThread({ conversationId: id, items: [], loaded: false, error: "" });
    }
    setUnread((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function startChat(target) {
    const existing = conversations.find(
      (c) => otherParticipant(c, user.id).id === target.id,
    );
    if (existing) {
      openConversation(existing.id);
      return;
    }
    setActive({ draftUser: target });
    setThread(EMPTY_THREAD);
  }

  function closeChat() {
    setActive(null);
    setThread(EMPTY_THREAD);
  }

  const sendMessage = useCallback(
    (text) =>
      new Promise((resolve) => {
        const target = active?.conversationId
          ? { conversationId: active.conversationId }
          : { recipientId: active.draftUser.id };

        socket.timeout(5000).emit("send_message", { ...target, text }, (err, response) => {
          if (err) {
            resolve({ ok: false, error: "Server didn't respond. Try again." });
            return;
          }
          if (response.ok && !active.conversationId) {
            const { conversation, message } = response;
            setConversations((prev) => upsertConversation(prev, conversation));
            setActive({ conversationId: conversation.id });
            setThread({
              conversationId: conversation.id,
              items: [{ type: "message", ...message }],
              loaded: false,
              error: "",
            });
          }
          resolve(response);
        });
      }),
    [active],
  );

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

            <MessageList
              key={`messages-${person.id}`}
              items={thread.items}
              loading={!thread.loaded && thread.items.length === 0}
              currentUserId={user.id}
              typing={Boolean(activeConversationId && typingIn[activeConversationId])}
              showAuthors={false}
              intro={<ChatIntro person={person} />}
            />

            <Composer
              key={`composer-${person.id}`}
              onSend={sendMessage}
              onTyping={activeConversationId ? sendTyping : undefined}
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
