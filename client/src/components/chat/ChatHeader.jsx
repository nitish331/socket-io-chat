import Avatar from "../Avatar";
import Icon from "../Icon";
import { lastSeenLabel } from "../../utils/format";

function statusText(presence, typing) {
  if (typing) return { text: "typing…", className: "typing" };
  if (presence?.online) return { text: "online", className: "online" };
  if (presence?.lastSeen) return { text: lastSeenLabel(presence.lastSeen), className: "" };
  return null;
}

function ChatHeader({ person, presence, typing, isConnected, onBack }) {
  const status = statusText(presence, typing);

  return (
    <header className="chat-header">
      <button
        type="button"
        className="icon-btn chat-back"
        onClick={onBack}
        aria-label="Back to chats"
      >
        <Icon name="arrowLeft" />
      </button>

      <div className="chat-title">
        <Avatar
          name={person.username}
          size={40}
          status={presence?.online ? "online" : undefined}
        />
        <div className="chat-title-text">
          <h1>{person.username}</h1>
          <p className={status?.className} aria-live="polite">
            {status ? status.text : `@${person.username}`}
          </p>
        </div>
      </div>

      <div className={`conn-pill ${isConnected ? "live" : "down"}`}>
        <span className="conn-dot" />
        {isConnected ? "Live" : "Reconnecting"}
      </div>
    </header>
  );
}

export default ChatHeader;
