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
          <h2>Where your team&apos;s conversations come alive.</h2>
          <p>
            Real-time channels, instant delivery and a calm, focused space to
            talk — built on Socket.io.
          </p>
        </div>

        <div className="auth-preview">
          <div className="auth-preview-header">
            <span className="auth-preview-hash">#</span> general
            <span className="auth-preview-live">
              <span /> Live
            </span>
          </div>
          <PreviewBubble name="priya" text="Deploy is green 🚀" delay={150} />
          <PreviewBubble name="arjun_dev" text="Nice! Shipping the release notes now" delay={550} />
          <PreviewBubble mine text="Great work everyone 🙌" delay={950} />
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
