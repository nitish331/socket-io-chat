import { useState } from "react";
import Avatar from "../Avatar";
import Icon from "../Icon";
import Logo from "../Logo";
import ThemeToggle from "../ThemeToggle";
import {
  conversationTitle,
  groupReceiptStatus,
  isGroup,
  listTime,
  otherParticipant,
  othersReceipts,
  typingLabel,
} from "../../utils/format";
import { useUserSearch } from "./useUserSearch";
import Ticks from "./Ticks";

function Highlight({ text, query }) {
  const index = query ? text.toLowerCase().indexOf(query) : -1;
  if (index === -1) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
}

function systemPreview(text, myUsername) {
  return text.startsWith(`${myUsername} `) ? `You${text.slice(myUsername.length)}` : text;
}

function ChatItem({
  conversation,
  currentUser,
  active,
  unread,
  online,
  typingIds = [],
  query,
  onClick,
}) {
  const group = isGroup(conversation);
  const title = conversationTitle(conversation, currentUser.id);
  const last = conversation.lastMessage;
  const mine = last?.senderId === currentUser.id;
  const nameOf = (id) => conversation.participants.find((p) => p.id === id)?.username;

  const typingNames = typingIds.map(nameOf).filter(Boolean);
  const typing = typingIds.length > 0;
  const typingText = group ? typingLabel(typingNames) : "typing…";

  let preview;
  if (typing) {
    preview = typingText;
  } else if (!last) {
    preview = "No messages yet";
  } else if (last.kind === "system") {
    preview = <span className="system-preview">{systemPreview(last.text, currentUser.username)}</span>;
  } else if (last.deleted) {
    preview = (
      <span className="deleted-preview">
        <Icon name="ban" size={13} />
        {mine ? "You deleted this message" : "This message was deleted"}
      </span>
    );
  } else {
    preview = (
      <>
        {mine && (
          <Ticks
            status={groupReceiptStatus(last.createdAt, othersReceipts(conversation, currentUser.id))}
          />
        )}
        {group && !mine && <span className="chat-item-sender">{nameOf(last.senderId) ?? "Someone"}: </span>}
        {last.text}
      </>
    );
  }

  return (
    <li>
      <button
        type="button"
        className={`chat-item ${active ? "active" : ""} ${unread ? "unread" : ""}`}
        onClick={onClick}
        aria-current={active ? "page" : undefined}
      >
        <Avatar name={title} size={44} status={!group && online ? "online" : undefined} />
        <span className="chat-item-body">
          <span className="chat-item-top">
            <span className="chat-item-name">
              {group && <Icon name="users" size={14} className="chat-item-group-icon" />}
              <span className="chat-item-title">
                <Highlight text={title} query={query} />
              </span>
            </span>
            {last && <span className="chat-item-time">{listTime(last.createdAt)}</span>}
          </span>
          <span className="chat-item-bottom">
            <span className={`chat-item-preview ${typing ? "typing" : ""}`}>{preview}</span>
            {unread > 0 && <span className="unread-badge">{unread > 99 ? "99+" : unread}</span>}
          </span>
        </span>
      </button>
    </li>
  );
}

function PersonItem({ person, query, onClick }) {
  return (
    <li>
      <button type="button" className="chat-item person" onClick={onClick}>
        <Avatar name={person.username} size={44} />
        <span className="chat-item-body">
          <span className="chat-item-name">
            <span className="chat-item-title">
              <Highlight text={person.username} query={query} />
            </span>
          </span>
          <span className="chat-item-preview">Tap to start a new chat</span>
        </span>
        <Icon name="newChat" size={17} className="person-action" />
      </button>
    </li>
  );
}

function Sidebar({
  conversations,
  loading,
  activeKey,
  unread,
  presence,
  typingIn,
  currentUser,
  isConnected,
  onOpenConversation,
  onStartChat,
  onNewGroup,
  onLogout,
  searchRef,
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const { users, searching, error } = useUserSearch(query);

  const matchingChats = q
    ? conversations.filter((c) =>
        conversationTitle(c, currentUser.id).toLowerCase().includes(q),
      )
    : conversations;

  const directChatUserIds = new Set(
    conversations
      .filter((c) => !isGroup(c))
      .map((c) => otherParticipant(c, currentUser.id).id),
  );
  const newPeople = users.filter((u) => !directChatUserIds.has(u.id));

  function renderChatItem(c, highlight) {
    const online = !isGroup(c) && presence[otherParticipant(c, currentUser.id).id]?.online;
    return (
      <ChatItem
        key={c.id}
        conversation={c}
        currentUser={currentUser}
        active={c.id === activeKey}
        unread={unread[c.id] || 0}
        online={online}
        typingIds={Array.isArray(typingIn[c.id]) ? typingIn[c.id] : []}
        query={highlight}
        onClick={() => openConversation(c.id)}
      />
    );
  }

  function clearSearch() {
    setQuery("");
  }

  function startChat(person) {
    clearSearch();
    onStartChat(person);
  }

  function openConversation(id) {
    clearSearch();
    onOpenConversation(id);
  }

  return (
    <aside className="sidebar" aria-label="Chats">
      <div className="sidebar-top">
        <div className="brand">
          <Logo size={30} />
          <span className="brand-name">Relay</span>
        </div>
        <div className="sidebar-top-actions">
          <button
            type="button"
            className="icon-btn sidebar-icon-btn"
            onClick={onNewGroup}
            aria-label="New group"
            title="New group"
          >
            <Icon name="users" />
          </button>
          <button
            type="button"
            className="icon-btn sidebar-icon-btn"
            onClick={() => searchRef.current?.focus()}
            aria-label="New chat"
            title="New chat"
          >
            <Icon name="newChat" />
          </button>
        </div>
      </div>

      <div className="sidebar-search">
        <Icon name="search" size={16} />
        <input
          ref={searchRef}
          type="text"
          placeholder="Search or start a new chat"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && clearSearch()}
          aria-label="Search chats and people"
          spellCheck={false}
        />
        {query && (
          <button
            type="button"
            className="search-clear"
            onClick={() => {
              clearSearch();
              searchRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            <Icon name="x" size={14} strokeWidth={2.5} />
          </button>
        )}
      </div>

      <nav className="sidebar-nav">
        {!q && (
          <>
            <h2 className="sidebar-heading">Chats</h2>
            {loading && conversations.length === 0 ? (
              <ul className="chat-skeletons" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="chat-skeleton">
                    <span className="sk-avatar" />
                    <span className="sk-lines">
                      <span />
                      <span />
                    </span>
                  </li>
                ))}
              </ul>
            ) : conversations.length === 0 ? (
              <div className="sidebar-empty-state">
                <Icon name="message" size={22} />
                <p className="title">No chats yet</p>
                <p>Search for someone by username above to start your first conversation.</p>
              </div>
            ) : (
              <ul className="chat-list">{conversations.map((c) => renderChatItem(c))}</ul>
            )}
          </>
        )}

        {q && (
          <>
            {matchingChats.length > 0 && (
              <>
                <h2 className="sidebar-heading">Chats</h2>
                <ul className="chat-list">{matchingChats.map((c) => renderChatItem(c, q))}</ul>
              </>
            )}

            <h2 className="sidebar-heading">
              People
              {searching && <span className="mini-spinner" aria-label="Searching" />}
            </h2>
            {error ? (
              <p className="sidebar-note error">{error}</p>
            ) : newPeople.length > 0 ? (
              <ul className="chat-list">
                {newPeople.map((person) => (
                  <PersonItem
                    key={person.id}
                    person={person}
                    query={q}
                    onClick={() => startChat(person)}
                  />
                ))}
              </ul>
            ) : (
              !searching && (
                <p className="sidebar-note">
                  {matchingChats.length > 0
                    ? "No one else matches"
                    : `No one found for “${query.trim()}”`}
                </p>
              )
            )}
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <Avatar
          name={currentUser.username}
          size={36}
          status={isConnected ? "online" : "offline"}
        />
        <div className="sidebar-me">
          <span className="sidebar-me-name">{currentUser.username}</span>
          <span className="sidebar-me-status">{isConnected ? "Active" : "Offline"}</span>
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
