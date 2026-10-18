import { useLayoutEffect, useRef, useState } from "react";
import Icon from "../Icon";

const MAX_LENGTH = 2000;
const MAX_HEIGHT = 180;

function Composer({ onSend, disabled, placeholder }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [text]);

  const canSend = !disabled && !sending && text.trim().length > 0;

  async function submit() {
    if (!canSend) return;
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

      <div className={`composer-box ${disabled ? "disabled" : ""}`}>
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
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
