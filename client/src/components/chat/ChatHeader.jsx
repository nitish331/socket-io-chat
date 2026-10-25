import Avatar from "../Avatar";
import Icon from "../Icon";

function ChatHeader({
  title,
  avatarName,
  subtitle,
  subtitleClass = "",
  online = false,
  isConnected,
  onBack,
  onOpenInfo,
}) {
  const titleContent = (
    <>
      <Avatar name={avatarName} size={40} status={online ? "online" : undefined} />
      <div className="chat-title-text">
        <h1>{title}</h1>
        <p className={subtitleClass} aria-live="polite">
          {subtitle}
        </p>
      </div>
    </>
  );

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

      {onOpenInfo ? (
        <button
          type="button"
          className="chat-title clickable"
          onClick={onOpenInfo}
          title="Group info"
        >
          {titleContent}
        </button>
      ) : (
        <div className="chat-title">{titleContent}</div>
      )}

      {onOpenInfo && (
        <button
          type="button"
          className="icon-btn"
          onClick={onOpenInfo}
          aria-label="Group info"
          title="Group info"
        >
          <Icon name="info" />
        </button>
      )}

      <div className={`conn-pill ${isConnected ? "live" : "down"}`}>
        <span className="conn-dot" />
        {isConnected ? "Live" : "Reconnecting"}
      </div>
    </header>
  );
}

export default ChatHeader;
