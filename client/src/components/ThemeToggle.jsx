import Icon from "./Icon";
import { useTheme } from "../theme/useTheme";

function ThemeToggle({ className = "icon-btn" }) {
  const { theme, toggleTheme } = useTheme();
  const label = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

  return (
    <button
      type="button"
      className={className}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} />
    </button>
  );
}

export default ThemeToggle;
