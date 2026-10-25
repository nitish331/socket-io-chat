import { useState } from "react";
import Modal from "../Modal";
import MemberPicker from "./MemberPicker";

const MAX_NAME = 50;
const MAX_MEMBERS = 49;

function NewGroupModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [members, setMembers] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canCreate = name.trim().length > 0 && members.length > 0 && !submitting;

  async function create() {
    if (!canCreate) return;
    setSubmitting(true);
    setError("");
    const result = await onCreate(name.trim(), members);
    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="New group"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary-btn" onClick={create} disabled={!canCreate}>
            {submitting ? "Creating…" : "Create group"}
          </button>
        </>
      }
    >
      <div className="form-field">
        <label htmlFor="group-name">Group name</label>
        <input
          id="group-name"
          className="text-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder="e.g. Weekend trip"
          maxLength={MAX_NAME}
          autoFocus
        />
      </div>

      <div className="form-field">
        <span className="field-label">
          Members
          {members.length > 0 && <span className="field-count">{members.length} selected</span>}
        </span>
        <MemberPicker selected={members} onChange={setMembers} max={MAX_MEMBERS} />
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}

export default NewGroupModal;
