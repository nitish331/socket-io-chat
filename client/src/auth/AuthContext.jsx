import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api";
import { TOKEN_KEY } from "../config";
import { AuthContext } from "./useAuth";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() =>
    Boolean(localStorage.getItem(TOKEN_KEY)),
  );

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    let cancelled = false;
    apiRequest("/api/auth/me", { token })
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch((err) => {
        if (!cancelled && err.status === 401) localStorage.removeItem(TOKEN_KEY);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const saveSession = useCallback(({ token, user }) => {
    localStorage.setItem(TOKEN_KEY, token);
    setUser(user);
  }, []);

  const login = useCallback(
    async (username, password) => {
      const data = await apiRequest("/api/auth/login", {
        method: "POST",
        body: { username, password },
      });
      saveSession(data);
    },
    [saveSession],
  );

  const register = useCallback(
    async (username, password) => {
      const data = await apiRequest("/api/auth/register", {
        method: "POST",
        body: { username, password },
      });
      saveSession(data);
    },
    [saveSession],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
