import Icon from "../Icon";

function ChatHeader({ channel, isConnected, onOpenSidebar }) {
  return (
    <header className="chat-header">
      <button
        type="button"
        className="icon-btn chat-menu"
        onClick={onOpenSidebar}
        aria-label="Open sidebar"
      >
        <Icon name="menu" />
      </button>

      <div className="chat-title">
        <span className="chat-title-icon">
          <Icon name="hash" size={18} strokeWidth={2.4} />
        </span>
        <div className="chat-title-text">
          <h1>{channel.name}</h1>
          <p>{channel.description}</p>
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
