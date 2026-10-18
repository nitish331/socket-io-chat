import { useEffect, useState } from "react";
import { authRequest } from "../../api";

const DEBOUNCE_MS = 250;

export function useUserSearch(query) {
  const q = query.trim().toLowerCase();
  const [result, setResult] = useState({ query: "", users: [], error: "" });

  useEffect(() => {
    if (!q) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await authRequest(`/api/users/search?q=${encodeURIComponent(q)}`);
        if (!cancelled) setResult({ query: q, users: data.users, error: "" });
      } catch (err) {
        if (!cancelled) setResult({ query: q, users: [], error: err.message });
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  const fresh = result.query === q;
  return {
    users: q && fresh ? result.users : [],
    error: q && fresh ? result.error : "",
    searching: Boolean(q) && !fresh,
  };
}
