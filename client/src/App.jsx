import { useEffect, useState } from "react";
import { socket } from "./socket";
import "./App.css";

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [socketId, setSocketId] = useState("");
  const [welcome, setWelcome] = useState("");

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
      setSocketId(socket.id);
    }

    function onDisconnect() {
      setIsConnected(false);
      setSocketId("");
    }

    function onWelcome(data) {
      setWelcome(data.message);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("welcome", onWelcome);

    socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("welcome", onWelcome);
      socket.disconnect();
    };
  }, []);

  return (
    <div className="app">
      <h1>Chat App</h1>

      <div className={`status ${isConnected ? "online" : "offline"}`}>
        {isConnected ? "Connected" : "Disconnected"}
      </div>

      {socketId && (
        <p>
          Your socket id: <code>{socketId}</code>
        </p>
      )}

      {welcome && <p className="welcome">{welcome}</p>}
    </div>
  );
}

export default App;
