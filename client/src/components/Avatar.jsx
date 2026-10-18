import { avatarColor, initials } from "../utils/format";

function Avatar({ name, size = 36, status }) {
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        background: avatarColor(name),
      }}
      title={name}
    >
      {initials(name)}
      {status && <span className={`avatar-status ${status}`} />}
    </span>
  );
}

export default Avatar;
