import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import AuthLayout from "../components/auth/AuthLayout";
import PasswordInput from "../components/auth/PasswordInput";
import Icon from "../components/Icon";
import "./Auth.css";

const USERNAME_RULE = /^[a-z0-9_]{3,20}$/;

function Rule({ ok, children }) {
  return (
    <li className={ok ? "ok" : ""}>
      <Icon name="check" size={13} strokeWidth={3} />
      {children}
    </li>
  );
}

function Register() {
  const { register } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const usernameValid = USERNAME_RULE.test(username);
  const passwordValid = password.length >= 6 && password.length <= 72;
  const matches = confirm.length > 0 && confirm === password;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!usernameValid) {
      setError("Username must be 3-20 characters: lowercase letters, numbers or _");
      return;
    }
    if (!passwordValid) {
      setError("Password must be between 6 and 72 characters");
      return;
    }
    if (!matches) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      await register(username, password);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="Join the conversation in under a minute.">
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="reg-username">Username</label>
          <div className="input-with-prefix">
            <span>@</span>
            <input
              id="reg-username"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))
              }
              autoComplete="username"
              placeholder="your_username"
              maxLength={20}
              autoFocus
            />
          </div>
          <ul className="field-rules">
            <Rule ok={username.length >= 3 && username.length <= 20}>3-20 characters</Rule>
            <Rule ok={username.length > 0 && /^[a-z0-9_]+$/.test(username)}>
              Letters, numbers or _
            </Rule>
          </ul>
        </div>

        <div className="field">
          <label htmlFor="reg-password">Password</label>
          <PasswordInput
            id="reg-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="At least 6 characters"
            maxLength={72}
          />
        </div>

        <div className="field">
          <label htmlFor="reg-confirm">Confirm password</label>
          <PasswordInput
            id="reg-confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            placeholder="Type it again"
            maxLength={72}
          />
          {confirm.length > 0 && (
            <ul className="field-rules">
              <Rule ok={matches}>{matches ? "Passwords match" : "Passwords don't match yet"}</Rule>
            </ul>
          )}
        </div>

        {error && (
          <p className="auth-error" role="alert">
            <Icon name="alert" size={16} />
            {error}
          </p>
        )}

        <button type="submit" className="auth-submit" disabled={submitting}>
          {submitting ? <span className="btn-spinner" /> : null}
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="auth-switch">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}

export default Register;
