"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const saved = window.localStorage.getItem("theme");
    const initial: Theme =
      saved === "dark" || saved === "light"
        ? saved
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    setTheme(initial);
    applyTheme(initial);
  }, []);

  function chooseTheme(nextTheme: Theme) {
    setTheme(nextTheme);
    window.localStorage.setItem("theme", nextTheme);
    applyTheme(nextTheme);
  }

  return (
    <div className="ml-auto inline-flex rounded border border-rule p-0.5 text-xs" aria-label="Theme">
      <button
        type="button"
        className={`px-2 py-1 ${theme === "light" ? "bg-ink text-paper" : "text-muted"}`}
        aria-pressed={theme === "light"}
        onClick={() => chooseTheme("light")}
      >
        Light
      </button>
      <button
        type="button"
        className={`px-2 py-1 ${theme === "dark" ? "bg-ink text-paper" : "text-muted"}`}
        aria-pressed={theme === "dark"}
        onClick={() => chooseTheme("dark")}
      >
        Dark
      </button>
    </div>
  );
}
