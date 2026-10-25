import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Icon from "../Icon";

const MAX_LENGTH = 2000;
const MAX_HEIGHT = 180;
const TYPING_REFRESH_MS = 3000;
const TYPING_IDLE_MS = 2500;

function Composer({ onSend, onTyping, disabled, placeholder, replyTo, onCancelReply }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const onTypingRef = useRef(onTyping);
  const typingRef = useRef({ active: false, lastSent: 0, timer: null });

  useEffect(() => {
    onTypingRef.current = onTyping;
  }, [onTyping]);

  const replyId = replyTo?.id ?? null;
  useEffect(() => {
    if (replyId) inputRef.current?.focus();
  }, [replyId]);

  function stopTyping() {
    const typing = typingRef.current;
    clearTimeout(typing.timer);
    if (typing.active) {
      typing.active = false;
      onTypingRef.current?.(false);
    }
  }

  useEffect(() => {
    const typing = typingRef.current;
    return () => {
      clearTimeout(typing.timer);
      if (typing.active) onTypingRef.current?.(false);
    };
  }, []);

  function handleChange(e) {
    const value = e.target.value;
    setText(value);
    if (!onTypingRef.current) return;

    if (!value.trim()) {
      stopTyping();
      return;
    }

    const typing = typingRef.current;
    const now = Date.now();
    if (!typing.active || now - typing.lastSent > TYPING_REFRESH_MS) {
      typing.active = true;
      typing.lastSent = now;
      onTypingRef.current(true);
    }
    clearTimeout(typing.timer);
    typing.timer = setTimeout(stopTyping, TYPING_IDLE_MS);
  }

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [text]);

  const canSend = !disabled && !sending && text.trim().length > 0;

  async function submit() {
    if (!canSend) return;
    stopTyping();
    setSending(true);
    setError("");

    const result = await onSend(text);

    setSending(false);
    if (result.ok) {
      setText("");
      inputRef.current?.focus();
    } else {
      setError(result.error);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape" && replyTo) {
      onCancelReply?.();
    }
  }

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {error && (
        <div className="composer-error" role="alert">
          <Icon name="alert" size={15} />
          {error}
        </div>
      )}

      {replyTo && (
        <div className="reply-bar">
          <Icon name="reply" size={16} />
          <div className="reply-bar-body">
            <span className="reply-bar-name">Replying to {replyTo.name}</span>
            <span className="reply-bar-text">{replyTo.text}</span>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onCancelReply}
            aria-label="Cancel reply"
            title="Cancel reply (Esc)"
          >
            <Icon name="x" size={16} />
          </button>
        </div>
      )}

      <div className={`composer-box ${disabled ? "disabled" : ""}`}>
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={MAX_LENGTH}
          aria-label="Message"
        />
        <button
          type="submit"
          className="send-btn"
          disabled={!canSend}
          aria-label="Send message"
          title="Send"
        >
          {sending ? <span className="send-spinner" /> : <Icon name="send" size={18} />}
        </button>
      </div>

      <div className="composer-hint">
        <span>
          <kbd>Enter</kbd> to send · <kbd>Shift</kbd> + <kbd>Enter</kbd> for a new line
        </span>
        {text.length > MAX_LENGTH - 200 && (
          <span className={text.length >= MAX_LENGTH ? "over" : ""}>
            {text.length}/{MAX_LENGTH}
          </span>
        )}
      </div>
    </form>
  );
}

export default Composer;
