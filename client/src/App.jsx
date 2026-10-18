import { useEffect, useRef, useState } from "react";
import { socket } from "./socket";
import "./App.css";

const shortId = (id) => id.slice(0, 5);

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [socketId, setSocketId] = useState("");
  const [items, setItems] = useState([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    function addSystem(text) {
      setItems((prev) => [
        ...prev,
        { type: "system", id: crypto.randomUUID(), text },
      ]);
    }

    function onConnect() {
      setIsConnected(true);
      setSocketId(socket.id);
      setItems([]);
    }

    function onDisconnect() {
      setIsConnected(false);
      setSocketId("");
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

    function onUserJoined({ userId }) {
      addSystem(`User ${shortId(userId)} joined`);
    }

    function onUserLeft({ userId }) {
      addSystem(`User ${shortId(userId)} left`);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("welcome", onWelcome);
    socket.on("receive_message", onReceiveMessage);
    socket.on("message_history", onMessageHistory);
    socket.on("user_joined", onUserJoined);
    socket.on("user_left", onUserLeft);

    socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("welcome", onWelcome);
      socket.off("receive_message", onReceiveMessage);
      socket.off("message_history", onMessageHistory);
      socket.off("user_joined", onUserJoined);
      socket.off("user_left", onUserLeft);
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [items]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim() || sending) return;

    setSending(true);
    setError("");

    socket.timeout(5000).emit("send_message", { text }, (err, response) => {
      setSending(false);
      if (err) {
        setError("Server did not respond. Try again.");
      } else if (!response.ok) {
        setError(response.error);
      } else {
        setText("");
      }
    });
  }

  return (
    <div className="chat">
      <header className="chat-header">
        <h1># general</h1>
        <div className={`status ${isConnected ? "online" : "offline"}`}>
          {isConnected ? `Connected as ${shortId(socketId)}` : "Disconnected"}
        </div>
      </header>

      <ul className="message-list" ref={listRef}>
        {items.map((item) =>
          item.type === "system" ? (
            <li key={item.id} className="system">
              {item.text}
            </li>
          ) : (
            <li
              key={item.id}
              className={`message ${item.senderId === socketId ? "mine" : ""}`}
            >
              <div className="meta">
                <span className="sender">
                  {item.senderId === socketId
                    ? "You"
                    : `User ${shortId(item.senderId)}`}
                </span>
                <span className="time">{formatTime(item.createdAt)}</span>
              </div>
              <div className="text">{item.text}</div>
            </li>
          ),
        )}
      </ul>

      <form className="composer" onSubmit={handleSubmit}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={isConnected ? "Message #general" : "Connecting..."}
          disabled={!isConnected}
          maxLength={2000}
        />
        <button type="submit" disabled={!isConnected || sending || !text.trim()}>
          Send
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

export default App;
