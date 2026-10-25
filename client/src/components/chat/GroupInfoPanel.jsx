import { useEffect, useState } from "react";
import Avatar from "../Avatar";
import Icon from "../Icon";
import Modal from "../Modal";
import MemberPicker from "./MemberPicker";

const MAX_MEMBERS = 50;
const MAX_NAME = 50;

function sortMembers(conversation, myId) {
  const admins = new Set(conversation.admins);
  return [...conversation.participants].sort((a, b) => {
    if (a.id === myId) return -1;
    if (b.id === myId) return 1;
    if (admins.has(a.id) !== admins.has(b.id)) return admins.has(a.id) ? -1 : 1;
    return a.username.localeCompare(b.username);
  });
}

function GroupInfoPanel({
  conversation,
  currentUser,
  presence,
  onClose,
  onRename,
  onAddMembers,
  onRemoveMember,
  onLeave,
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(conversation.name);
  const [confirm, setConfirm] = useState(null);
  const [adding, setAdding] = useState(false);
  const [toAdd, setToAdd] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const amAdmin = conversation.admins.includes(currentUser.id);
  const members = sortMembers(conversation, currentUser.id);
  const admins = new Set(conversation.admins);
  const spaceLeft = MAX_MEMBERS - conversation.participants.length;

  useEffect(() => {
    if (adding || editingName) return;
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [adding, editingName, onClose]);

  async function run(action) {
    setBusy(true);
    setError("");
    const result = await action();
    setBusy(false);
    if (!result.ok) setError(result.error);
    return result.ok;
  }

  async function saveName() {
    const name = nameDraft.trim();
    if (!name || name === conversation.name) {
      setEditingName(false);
      setNameDraft(conversation.name);
      return;
    }
    if (await run(() => onRename(name))) setEditingName(false);
  }

  async function confirmAdd() {
    if (toAdd.length === 0) return;
    if (await run(() => onAddMembers(toAdd))) {
      setAdding(false);
      setToAdd([]);
    }
  }

  async function confirmRemove(userId) {
    if (await run(() => onRemoveMember(userId))) setConfirm(null);
  }

  return (
    <aside className="group-info" aria-label="Group info">
      <header className="group-info-header">
        <h2>Group info</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close group info">
          <Icon name="x" />
        </button>
      </header>

      <div className="group-info-body">
        <section className="group-hero">
          <Avatar name={conversation.name} size={76} />
          {editingName ? (
            <div className="group-name-edit">
              <input
                className="text-input"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") {
                    setEditingName(false);
                    setNameDraft(conversation.name);
                  }
                }}
                maxLength={MAX_NAME}
                aria-label="Group name"
                autoFocus
              />
              <button type="button" className="primary-btn small" onClick={saveName} disabled={busy}>
                Save
              </button>
            </div>
          ) : (
            <h3 className="group-name">
              {conversation.name}
              {amAdmin && (
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => {
                    setNameDraft(conversation.name);
                    setEditingName(true);
                  }}
                  aria-label="Rename group"
                  title="Rename group"
                >
                  <Icon name="edit" size={16} />
                </button>
              )}
            </h3>
          )}
          <p className="group-meta">Group · {conversation.participants.length} members</p>
        </section>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <section className="group-section">
          <h4>{conversation.participants.length} members</h4>

          {amAdmin && (
            <button
              type="button"
              className="group-row add-row"
              onClick={() => setAdding(true)}
              disabled={spaceLeft <= 0}
            >
              <span className="add-icon">
                <Icon name="userPlus" size={18} />
              </span>
              <span>{spaceLeft > 0 ? "Add members" : "Group is full"}</span>
            </button>
          )}

          <ul className="member-list">
            {members.map((member) => {
              const isMe = member.id === currentUser.id;
              const confirming = confirm?.type === "remove" && confirm.id === member.id;
              return (
                <li key={member.id} className="group-row">
                  <Avatar
                    name={member.username}
                    size={38}
                    status={!isMe && presence[member.id]?.online ? "online" : undefined}
                  />
                  <span className="member-name">
                    {member.username}
                    {isMe && <span className="member-you"> (You)</span>}
                  </span>
                  {admins.has(member.id) && <span className="admin-badge">Admin</span>}
                  {amAdmin && !isMe && !confirming && (
                    <button
                      type="button"
                      className="text-btn danger"
                      onClick={() => setConfirm({ type: "remove", id: member.id })}
                    >
                      Remove
                    </button>
                  )}
                  {confirming && (
                    <span className="inline-confirm">
                      <button
                        type="button"
                        className="confirm-btn danger"
                        onClick={() => confirmRemove(member.id)}
                        disabled={busy}
                      >
                        Remove
                      </button>
                      <button type="button" className="confirm-btn" onClick={() => setConfirm(null)}>
                        Cancel
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="group-section">
          {confirm?.type === "leave" ? (
            <div className="leave-confirm">
              <p>
                Leave <strong>{conversation.name}</strong>? You'll stop getting its messages.
              </p>
              <div className="leave-actions">
                <button type="button" className="secondary-btn" onClick={() => setConfirm(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="danger-btn"
                  onClick={() => run(onLeave)}
                  disabled={busy}
                >
                  Leave group
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="group-row leave-row"
              onClick={() => setConfirm({ type: "leave" })}
            >
              <Icon name="logOut" size={18} />
              <span>Leave group</span>
            </button>
          )}
        </section>
      </div>

      {adding && (
        <Modal
          title="Add members"
          onClose={() => {
            setAdding(false);
            setToAdd([]);
          }}
          footer={
            <>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  setAdding(false);
                  setToAdd([]);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={confirmAdd}
                disabled={toAdd.length === 0 || busy}
              >
                {busy ? "Adding…" : `Add${toAdd.length ? ` ${toAdd.length}` : ""}`}
              </button>
            </>
          }
        >
          <MemberPicker
            selected={toAdd}
            onChange={setToAdd}
            excludeIds={conversation.participants.map((p) => p.id)}
            max={spaceLeft}
            autoFocus
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}
    </aside>
  );
}

export default GroupInfoPanel;
