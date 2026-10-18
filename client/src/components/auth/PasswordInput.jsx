import { useState } from "react";
import Icon from "../Icon";

function PasswordInput(props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="input-with-action">
      <input {...props} type={visible ? "text" : "password"} />
      <button
        type="button"
        className="input-action"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
      >
        <Icon name={visible ? "eyeOff" : "eye"} size={17} />
      </button>
    </div>
  );
}

export default PasswordInput;
