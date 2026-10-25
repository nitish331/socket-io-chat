import { useState } from "react";
import Avatar from "../Avatar";
import Icon from "../Icon";
import { useUserSearch } from "./useUserSearch";

function MemberPicker({ selected, onChange, excludeIds = [], max = Infinity, autoFocus = false }) {
  const [query, setQuery] = useState("");
  const { users, searching, error } = useUserSearch(query);

  const hidden = new Set([...excludeIds, ...selected.map((u) => u.id)]);
  const results = users.filter((u) => !hidden.has(u.id));
  const full = selected.length >= max;

  function add(person) {
    if (full) return;
    onChange([...selected, person]);
    setQuery("");
  }

  function remove(id) {
    onChange(selected.filter((u) => u.id !== id));
  }

  let content;
  if (!query.trim()) {
    content = <li className="picker-note">Type a username to find people</li>;
  } else if (error) {
    content = <li className="picker-note error">{error}</li>;
  } else if (searching && results.length === 0) {
    content = <li className="picker-note">Searching…</li>;
  } else if (results.length === 0) {
    content = <li className="picker-note">No one found for “{query.trim()}”</li>;
  } else {
    content = results.map((person) => (
      <li key={person.id}>
        <button
          type="button"
          className="picker-result"
          onClick={() => add(person)}
          disabled={full}
        >
          <Avatar name={person.username} size={32} />
          <span className="picker-result-name">{person.username}</span>
          <Icon name="userPlus" size={17} />
        </button>
      </li>
    ));
  }

  return (
    <div className="member-picker">
      {selected.length > 0 && (
        <ul className="picker-chips" aria-label="Selected people">
          {selected.map((person) => (
            <li key={person.id} className="picker-chip">
              <Avatar name={person.username} size={22} />
              <span>{person.username}</span>
              <button
                type="button"
                onClick={() => remove(person.id)}
                aria-label={`Remove ${person.username}`}
              >
                <Icon name="x" size={12} strokeWidth={2.6} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="picker-search">
        <Icon name="search" size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people by username"
          aria-label="Search people"
          spellCheck={false}
          autoFocus={autoFocus}
        />
        {searching && <span className="mini-spinner" aria-hidden="true" />}
      </label>

      {full && <p className="picker-note">That's the maximum group size.</p>}

      <ul className="picker-results">{content}</ul>
    </div>
  );
}

export default MemberPicker;
