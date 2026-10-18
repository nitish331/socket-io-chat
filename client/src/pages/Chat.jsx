import { useCallback, useEffect, useState } from "react";
import { socket } from "../socket";
import { useAuth } from "../auth/useAuth";
import Sidebar from "../components/chat/Sidebar";
import ChatHeader from "../components/chat/ChatHeader";
import MessageList from "../components/chat/MessageList";
import Composer from "../components/chat/Composer";
import Icon from "../components/Icon";
import "./Chat.css";

const CHANNELS = [
  {
    id: "general",
    name: "general",
    description: "Company-wide announcements and everyday chatter",
  },
];

function Chat() {
  const { user, logout } = useAuth();
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [connectionIssue, setConnectionIssue] = useState("");
  const [items, setItems] = useState([]);
  const [activeChannelId, setActiveChannelId] = useState(CHANNELS[0].id);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeChannel = CHANNELS.find((c) => c.id === activeChannelId);

  useEffect(() => {
    function addSystem(text) {
      setItems((prev) => [
        ...prev,
        { type: "system", id: crypto.randomUUID(), text },
      ]);
    }

    function onConnect() {
      setIsConnected(true);
      setConnectionIssue("");
      setItems([]);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    function onConnectError(err) {
      if (err.message === "Unauthorized") {
        logout();
      } else {
        setConnectionIssue("Can't reach the chat server. Retrying…");
      }
    }

    function onWelcome(data) {
      addSystem(data.message);
    }

    function onReceiveMessage(message) {
      setItems((prev) => [...prev, { type: "message", ...message }]);
    }

    function onMessageHistory(history) {
      setItems((prev) => {
        const historyIds = new Set(history.map((m) => m.id));
        const arrivedMeanwhile = prev.filter((i) => !historyIds.has(i.id));
        return [
          ...history.map((m) => ({ type: "message", ...m })),
          ...arrivedMeanwhile,
        ];
      });
    }

    function onUserJoined({ username }) {
      addSystem(`${username} joined`);
    }

    function onUserLeft({ username }) {
      addSystem(`${username} left`);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("welcome", onWelcome);
    socket.on("receive_message", onReceiveMessage);
    socket.on("message_history", onMessageHistory);
    socket.on("user_joined", onUserJoined);
    socket.on("user_left", onUserLeft);

    socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("welcome", onWelcome);
      socket.off("receive_message", onReceiveMessage);
      socket.off("message_history", onMessageHistory);
      socket.off("user_joined", onUserJoined);
      socket.off("user_left", onUserLeft);
      socket.disconnect();
    };
  }, [logout]);

  useEffect(() => {
    if (!sidebarOpen) return;
    function onKey(e) {
      if (e.key === "Escape") setSidebarOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  const sendMessage = useCallback(
    (text) =>
      new Promise((resolve) => {
        socket.timeout(5000).emit("send_message", { text }, (err, response) => {
          if (err) resolve({ ok: false, error: "Server didn't respond. Try again." });
          else resolve(response);
        });
      }),
    [],
  );

  function selectChannel(id) {
    setActiveChannelId(id);
    setSidebarOpen(false);
  }

  return (
    <div className="workspace">
      <Sidebar
        channels={CHANNELS}
        activeChannelId={activeChannelId}
        onSelectChannel={selectChannel}
        user={user}
        isConnected={isConnected}
        onLogout={logout}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      <main className="conversation">
        <ChatHeader
          channel={activeChannel}
          isConnected={isConnected}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        {!isConnected && (
          <div className="conn-banner" role="status">
            <Icon name="alert" size={16} />
            {connectionIssue || "Connection lost. Reconnecting…"}
          </div>
        )}

        <MessageList
          items={items}
          currentUserId={user.id}
          channelName={activeChannel.name}
        />

        <Composer
          onSend={sendMessage}
          disabled={!isConnected}
          placeholder={isConnected ? `Message #${activeChannel.name}` : "Waiting for connection…"}
        />
      </main>
    </div>
  );
}

export default Chat;
