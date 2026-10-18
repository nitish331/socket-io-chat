import Logo from "../Logo";
import ThemeToggle from "../ThemeToggle";
import Avatar from "../Avatar";

function PreviewBubble({ name, text, mine, delay }) {
  return (
    <div
      className={`preview-msg ${mine ? "mine" : ""}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {!mine && <Avatar name={name} size={28} />}
      <div className="preview-bubble">
        {!mine && <span className="preview-name">{name}</span>}
        {text}
      </div>
    </div>
  );
}

function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="auth">
      <aside className="auth-hero" aria-hidden="true">
        <div className="auth-hero-brand">
          <Logo size={36} />
          <span>Relay</span>
        </div>

        <div className="auth-hero-copy">
          <h2>Conversations that feel instant.</h2>
          <p>
            Find anyone by username, start a chat in one tap, and watch
            messages land in real time — built on Socket.io.
          </p>
        </div>

        <div className="auth-preview">
          <div className="auth-preview-header">
            <Avatar name="priya" size={26} />
            priya
            <span className="auth-preview-live">
              <span /> Live
            </span>
          </div>
          <PreviewBubble name="priya" text="Are we still on for the demo? 🚀" delay={150} />
          <PreviewBubble mine text="Yes! Sharing the link in a minute" delay={550} />
          <PreviewBubble name="priya" text="Perfect, see you there 🙌" delay={950} />
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-topbar">
          <div className="auth-mobile-brand">
            <Logo size={28} />
            <span>Relay</span>
          </div>
          <ThemeToggle />
        </div>

        <div className="auth-card">
          <h1>{title}</h1>
          <p className="auth-subtitle">{subtitle}</p>
          {children}
        </div>
      </main>
    </div>
  );
}

export default AuthLayout;
