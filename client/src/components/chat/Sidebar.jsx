import { useState } from "react";
import Avatar from "../Avatar";
import Icon from "../Icon";
import Logo from "../Logo";
import ThemeToggle from "../ThemeToggle";

function Sidebar({
  channels,
  activeChannelId,
  onSelectChannel,
  user,
  isConnected,
  onLogout,
  open,
  onClose,
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visibleChannels = q
    ? channels.filter((c) => c.name.includes(q))
    : channels;

  return (
    <aside className={`sidebar ${open ? "open" : ""}`} aria-label="Workspace">
      <div className="sidebar-top">
        <div className="brand">
          <Logo size={30} />
          <span className="brand-name">Relay</span>
        </div>
        <button
          type="button"
          className="icon-btn sidebar-close"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          <Icon name="x" />
        </button>
      </div>

      <label className="sidebar-search">
        <Icon name="search" size={16} />
        <input
          type="search"
          placeholder="Search channels"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      <nav className="sidebar-nav">
        <section className="sidebar-section">
          <h2 className="sidebar-heading">
            Channels
            <span className="sidebar-count">{channels.length}</span>
          </h2>
          <ul>
            {visibleChannels.map((channel) => (
              <li key={channel.id}>
                <button
                  type="button"
                  className={`sidebar-item ${
                    channel.id === activeChannelId ? "active" : ""
                  }`}
                  onClick={() => onSelectChannel(channel.id)}
                  aria-current={channel.id === activeChannelId ? "page" : undefined}
                >
                  <Icon name="hash" size={16} />
                  <span className="sidebar-item-label">{channel.name}</span>
                </button>
              </li>
            ))}
            {visibleChannels.length === 0 && (
              <li className="sidebar-empty">No channels match “{query}”</li>
            )}
          </ul>
        </section>

        <section className="sidebar-section">
          <h2 className="sidebar-heading">Direct messages</h2>
          <div className="sidebar-placeholder">
            <Icon name="message" size={16} />
            <span>No conversations yet</span>
          </div>
        </section>
      </nav>

      <div className="sidebar-footer">
        <Avatar
          name={user.username}
          size={36}
          status={isConnected ? "online" : "offline"}
        />
        <div className="sidebar-me">
          <span className="sidebar-me-name">{user.username}</span>
          <span className="sidebar-me-status">
            {isConnected ? "Active" : "Offline"}
          </span>
        </div>
        <ThemeToggle className="icon-btn sidebar-icon-btn" />
        <button
          type="button"
          className="icon-btn sidebar-icon-btn"
          onClick={onLogout}
          aria-label="Log out"
          title="Log out"
        >
          <Icon name="logOut" />
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
