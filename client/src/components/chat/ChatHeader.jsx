import Avatar from "../Avatar";
import Icon from "../Icon";

function ChatHeader({ person, isConnected, onBack }) {
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
        <Avatar name={person.username} size={40} />
        <div className="chat-title-text">
          <h1>{person.username}</h1>
          <p>@{person.username}</p>
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
