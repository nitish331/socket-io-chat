import Avatar from "../Avatar";
import Icon from "../Icon";
import Ticks from "./Ticks";
import { avatarColor, formatTime } from "../../utils/format";
import { REACTIONS, groupReactions, myReaction } from "../../utils/reactions";

const canHover =
  typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;

function ReplyQuote({ replyTo, currentUserId, onJumpTo }) {
  const name =
    replyTo.sender?.id === currentUserId ? "You" : (replyTo.sender?.username ?? "Unknown");

  return (
    <button
      type="button"
      className="reply-quote"
      onClick={(e) => {
        e.stopPropagation();
        onJumpTo(replyTo.id);
      }}
      title="Go to original message"
    >
      <span className="reply-quote-name">{name}</span>
      <span className={`reply-quote-text ${replyTo.deleted ? "deleted" : ""}`}>
        {replyTo.deleted ? "This message was deleted" : replyTo.text}
      </span>
    </button>
  );
}

function ActionBar({ item, mine, mode, currentUserId, onMenu, onReply, onReact, onDelete }) {
  const chosen = myReaction(item.reactions, currentUserId);

  return (
    <div
      className={`msg-actions ${mode ? `mode-${mode}` : ""}`}
      role="toolbar"
      aria-label="Message actions"
      onClick={(e) => e.stopPropagation()}
    >
      {mode === "react" ? (
        REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className={`react-option ${chosen === emoji ? "chosen" : ""}`}
            onClick={() => {
              onReact(item.id, emoji);
              onMenu(null);
            }}
            aria-label={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))
      ) : mode === "confirm" ? (
        <>
          <span className="confirm-text">Delete for everyone?</span>
          <button
            type="button"
            className="confirm-btn danger"
            onClick={() => {
              onDelete(item.id);
              onMenu(null);
            }}
          >
            Delete
          </button>
          <button type="button" className="confirm-btn" onClick={() => onMenu(null)}>
            Cancel
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="action-btn"
            onClick={() => onMenu("react")}
            aria-label="React"
            title="React"
          >
            <Icon name="smile" size={17} />
          </button>
          <button
            type="button"
            className="action-btn"
            onClick={() => {
              onReply(item);
              onMenu(null);
            }}
            aria-label="Reply"
            title="Reply"
          >
            <Icon name="reply" size={17} />
          </button>
          {mine && (
            <button
              type="button"
              className="action-btn danger"
              onClick={() => onMenu("confirm")}
              aria-label="Delete for everyone"
              title="Delete for everyone"
            >
              <Icon name="trash" size={16} />
            </button>
          )}
        </>
      )}
    </div>
  );
}

function MessageBubble({
  item,
  first,
  last,
  currentUserId,
  showAuthors,
  status,
  menuMode,
  highlighted,
  onMenu,
  onReply,
  onReact,
  onDelete,
  onJumpTo,
}) {
  const mine = item.sender.id === currentUserId;
  const name = item.sender.username;
  const reactions = groupReactions(item.reactions, currentUserId);

  function handleBubbleClick() {
    if (canHover || item.deleted) return;
    onMenu(menuMode ? null : "actions");
  }

  const classes = [
    "msg",
    mine ? "mine" : "theirs",
    first && "first",
    last && "last",
    item.deleted && "deleted",
    menuMode && "menu-open",
    highlighted && "flash",
    reactions.length > 0 && "has-reactions",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li className={classes} data-message-id={item.id}>
      {!mine && showAuthors && (
        <div className="msg-avatar">{first && <Avatar name={name} size={34} />}</div>
      )}

      <div className="msg-content">
        {first && !mine && showAuthors && (
          <div className="msg-author" style={{ color: avatarColor(name) }}>
            {name}
          </div>
        )}

        <div className="bubble-wrap">
          <div className="bubble" onClick={handleBubbleClick}>
            {item.replyTo && !item.deleted && (
              <ReplyQuote replyTo={item.replyTo} currentUserId={currentUserId} onJumpTo={onJumpTo} />
            )}
            <p className={`bubble-text ${item.deleted ? "deleted-text" : ""}`}>
              {item.deleted ? (
                <>
                  <Icon name="ban" size={14} />
                  {mine ? "You deleted this message" : "This message was deleted"}
                </>
              ) : (
                item.text
              )}
            </p>
            <span className="bubble-meta">
              <time className="bubble-time" dateTime={item.createdAt}>
                {formatTime(item.createdAt)}
              </time>
              {mine && status && !item.deleted && <Ticks status={status} />}
            </span>
          </div>

          {!item.deleted && (
            <ActionBar
              item={item}
              mine={mine}
              mode={menuMode === "actions" ? null : menuMode}
              currentUserId={currentUserId}
              onMenu={onMenu}
              onReply={onReply}
              onReact={onReact}
              onDelete={onDelete}
            />
          )}
        </div>

        {reactions.length > 0 && (
          <div className="reactions">
            {reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                className={`reaction-chip ${r.mine ? "mine" : ""}`}
                onClick={() => onReact(item.id, r.emoji)}
                title={r.mine ? "You reacted — tap to remove" : `React with ${r.emoji}`}
                aria-label={`${r.emoji} ${r.count}${r.mine ? ", including you" : ""}`}
              >
                <span>{r.emoji}</span>
                {r.count > 1 && <span className="reaction-count">{r.count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

export default MessageBubble;
