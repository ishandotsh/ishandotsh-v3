(() => {
  const root = document.documentElement;
  const toggle = document.querySelector("[data-theme-toggle]");
  const label = document.querySelector("[data-theme-toggle-label]");
  const icon = toggle?.querySelector(".theme-toggle-icon");
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  const lightQuery = window.matchMedia("(prefers-color-scheme: light)");

  function getStoredTheme() {
    try {
      return localStorage.getItem("theme");
    } catch {
      return null;
    }
  }

  function setStoredTheme(theme) {
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // Ignore private-mode/storage errors; the in-page switch still works.
    }
  }

  function applyTheme(theme) {
    root.dataset.theme = theme;

    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", theme === "light" ? "#f8f3ea" : "#141414");
    }

    if (!toggle) return;

    const isLight = theme === "light";
    toggle.setAttribute("aria-pressed", String(isLight));
    toggle.setAttribute("aria-label", `Switch to ${isLight ? "dark" : "light"} mode`);

    if (label) label.textContent = isLight ? "Light" : "Dark";
    if (icon) icon.textContent = isLight ? "☀" : "☾";
  }

  function preferredTheme() {
    return getStoredTheme() || (lightQuery.matches ? "light" : "dark");
  }

  applyTheme(root.dataset.theme || preferredTheme());

  toggle?.addEventListener("click", () => {
    const nextTheme = root.dataset.theme === "light" ? "dark" : "light";
    setStoredTheme(nextTheme);
    applyTheme(nextTheme);
  });

  lightQuery.addEventListener?.("change", () => {
    if (!getStoredTheme()) applyTheme(preferredTheme());
  });
})();
