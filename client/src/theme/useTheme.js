import { useCallback, useState } from "react";

const THEME_KEY = "chat_theme";

function initialTheme() {
  const current = document.documentElement.dataset.theme;
  if (current === "light" || current === "dark") return current;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function useTheme() {
  const [theme, setTheme] = useState(initialTheme);

  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // storage unavailable (private mode): theme still applies for this visit
    }
    setTheme(next);
  }, [theme]);

  return { theme, toggleTheme };
}
