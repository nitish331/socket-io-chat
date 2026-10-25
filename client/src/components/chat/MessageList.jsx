import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Icon from "../Icon";
import MessageBubble from "./MessageBubble";
import { dayLabel, isSameDay, receiptStatus } from "../../utils/format";

const GROUP_WINDOW_MS = 5 * 60 * 1000;
const BOTTOM_THRESHOLD = 80;
const TOP_THRESHOLD = 150;
const FLASH_MS = 1600;

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
  hasMore = false,
  loadingOlder = false,
  olderError = "",
  onLoadOlder,
  onReply,
  onReact,
  onDelete,
  onNotice,
}) {
  const listRef = useRef(null);
  const atBottomRef = useRef(true);
  const snapshotRef = useRef({ scrollHeight: 0, scrollTop: 0, firstId: null, lastId: null });
  const flashTimerRef = useRef(null);
  const [atBottom, setAtBottom] = useState(true);
  const [seenAt, setSeenAt] = useState(null);
  const [menu, setMenu] = useState(null);
  const [highlightId, setHighlightId] = useState(null);

  useEffect(() => {
    if (!menu) return;
    function onPointerDown(e) {
      if (!e.target.closest?.(`[data-message-id="${menu.id}"]`)) setMenu(null);
    }
    function onKeyDown(e) {
      if (e.key === "Escape") setMenu(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menu]);

  useEffect(() => () => clearTimeout(flashTimerRef.current), []);

  function jumpTo(messageId) {
    const el = listRef.current?.querySelector(`[data-message-id="${messageId}"]`);
    if (!el) {
      onNotice?.("That message is further back — scroll up to load it.");
      return;
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlightId(messageId);
    clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setHighlightId(null), FLASH_MS);
  }

  const rows = useMemo(() => buildRows(items), [items]);
  const messages = useMemo(() => items.filter((i) => i.type === "message"), [items]);
  const firstId = messages[0]?.id ?? null;
  const lastId = messages.at(-1)?.id ?? null;
  const unseen = seenAt ? messages.filter((m) => m.createdAt > seenAt).length : 0;

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const prev = snapshotRef.current;
    const prepended = prev.firstId && firstId !== prev.firstId && lastId === prev.lastId;

    if (prepended) {
      el.scrollTop = prev.scrollTop + (el.scrollHeight - prev.scrollHeight);
    } else {
      const last = items[items.length - 1];
      const mine = last?.type === "message" && last.sender.id === currentUserId;
      if (atBottomRef.current || mine) el.scrollTop = el.scrollHeight;
    }

    snapshotRef.current = {
      scrollHeight: el.scrollHeight,
      scrollTop: el.scrollTop,
      firstId,
      lastId,
    };
  }, [items, firstId, lastId, currentUserId, typing, hasMore]);

  function handleScroll() {
    const el = listRef.current;
    snapshotRef.current = { ...snapshotRef.current, scrollTop: el.scrollTop, scrollHeight: el.scrollHeight };

    const isBottom = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD;
    atBottomRef.current = isBottom;
    setAtBottom(isBottom);
    if (isBottom) setSeenAt(messages.at(-1)?.createdAt ?? null);

    if (el.scrollTop < TOP_THRESHOLD && hasMore && !loadingOlder && !olderError) {
      onLoadOlder?.();
    }
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
        ) : hasMore ? (
          <button
            type="button"
            className={`load-older ${olderError ? "error" : ""}`}
            onClick={onLoadOlder}
            disabled={loadingOlder}
          >
            {loadingOlder ? (
              <>
                <span className="mini-spinner" /> Loading older messages…
              </>
            ) : olderError ? (
              "Couldn't load older messages — tap to retry"
            ) : (
              "Load older messages"
            )}
          </button>
        ) : (
          intro
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
            return (
              <MessageBubble
                key={row.id}
                item={item}
                first={first}
                last={last}
                currentUserId={currentUserId}
                showAuthors={showAuthors}
                status={receiptStatus(item.createdAt, otherReceipt)}
                menuMode={menu?.id === item.id ? menu.mode : null}
                highlighted={highlightId === item.id}
                onMenu={(mode) => setMenu(mode ? { id: item.id, mode } : null)}
                onReply={onReply}
                onReact={onReact}
                onDelete={onDelete}
                onJumpTo={jumpTo}
              />
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
