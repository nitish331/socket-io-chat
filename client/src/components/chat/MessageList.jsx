import { useLayoutEffect, useMemo, useRef, useState } from "react";
import Avatar from "../Avatar";
import Icon from "../Icon";
import Ticks from "./Ticks";
import {
  avatarColor,
  dayLabel,
  formatTime,
  isSameDay,
  receiptStatus,
} from "../../utils/format";

const GROUP_WINDOW_MS = 5 * 60 * 1000;
const BOTTOM_THRESHOLD = 80;

function buildRows(items) {
  const rows = [];
  let prev = null;
  let lastDay = null;

  for (const item of items) {
    if (item.type === "system") {
      rows.push({ kind: "system", id: item.id, text: item.text });
      prev = null;
      continue;
    }

    if (!lastDay || !isSameDay(lastDay, item.createdAt)) {
      rows.push({ kind: "day", id: `day-${item.id}`, label: dayLabel(item.createdAt) });
      lastDay = item.createdAt;
      prev = null;
    }

    const grouped =
      prev &&
      prev.sender.id === item.sender.id &&
      new Date(item.createdAt) - new Date(prev.createdAt) < GROUP_WINDOW_MS;

    rows.push({ kind: "message", id: item.id, item, first: !grouped, last: true });
    if (grouped) rows[rows.length - 2].last = false;
    prev = item;
  }

  return rows;
}

function MessageList({
  items,
  currentUserId,
  intro,
  loading,
  otherReceipt = null,
  typing = false,
  showAuthors = true,
}) {
  const listRef = useRef(null);
  const atBottomRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);
  const [seenCount, setSeenCount] = useState(0);

  const rows = useMemo(() => buildRows(items), [items]);
  const messageCount = items.filter((i) => i.type === "message").length;
  const unseen = Math.max(0, messageCount - seenCount);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const last = items[items.length - 1];
    const mine = last?.type === "message" && last.sender.id === currentUserId;
    if (atBottomRef.current || mine) {
      el.scrollTop = el.scrollHeight;
    }
  }, [items, currentUserId, typing]);

  function handleScroll() {
    const el = listRef.current;
    const isBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD;
    atBottomRef.current = isBottom;
    setAtBottom(isBottom);
    if (isBottom) setSeenCount(messageCount);
  }

  function scrollToBottom() {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }

  return (
    <div className="messages-wrap">
      <div className="messages" ref={listRef} onScroll={handleScroll}>
        {loading ? (
          <div className="messages-loading" role="status" aria-label="Loading messages">
            <span className="spinner" />
          </div>
        ) : (
          messageCount === 0 && intro
        )}

        <ul className="message-rows">
          {rows.map((row) => {
            if (row.kind === "day") {
              return (
                <li key={row.id} className="day-divider">
                  <span>{row.label}</span>
                </li>
              );
            }

            if (row.kind === "system") {
              return (
                <li key={row.id} className="system-row">
                  <span>{row.text}</span>
                </li>
              );
            }

            const { item, first, last } = row;
            const mine = item.sender.id === currentUserId;
            const name = item.sender.username;

            return (
              <li
                key={row.id}
                className={`msg ${mine ? "mine" : "theirs"} ${first ? "first" : ""} ${
                  last ? "last" : ""
                }`}
              >
                {!mine && showAuthors && (
                  <div className="msg-avatar">
                    {first && <Avatar name={name} size={34} />}
                  </div>
                )}
                <div className="msg-content">
                  {first && !mine && showAuthors && (
                    <div className="msg-author" style={{ color: avatarColor(name) }}>
                      {name}
                    </div>
                  )}
                  <div className="bubble">
                    <p className="bubble-text">{item.text}</p>
                    <span className="bubble-meta">
                      <time className="bubble-time" dateTime={item.createdAt}>
                        {formatTime(item.createdAt)}
                      </time>
                      {mine && <Ticks status={receiptStatus(item.createdAt, otherReceipt)} />}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
          {typing && (
            <li className="msg theirs first last typing-row" aria-label="Typing">
              <div className="msg-content">
                <div className="bubble typing-bubble">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </li>
          )}
        </ul>
      </div>

      {!atBottom && (
        <button type="button" className="jump-btn" onClick={scrollToBottom}>
          <Icon name="arrowDown" size={16} />
          {unseen > 0 ? `${unseen} new message${unseen > 1 ? "s" : ""}` : "Jump to latest"}
        </button>
      )}
    </div>
  );
}

export default MessageList;
