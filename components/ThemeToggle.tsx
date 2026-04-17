// components/ThemeToggle.tsx
"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light" | "auto";
const CYCLE: Theme[] = ["dark", "light", "auto"];
const LABELS: Record<Theme, string> = {
  dark: "◑ dark",
  light: "◑ light",
  auto: "◑ auto",
};

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("auto");

  useEffect(() => {
    const saved = (localStorage.getItem("theme") as Theme) || "auto";
    setTheme(saved);
  }, []);

  function cycle() {
    const next = CYCLE[(CYCLE.indexOf(theme) + 1) % CYCLE.length];
    setTheme(next);
    localStorage.setItem("theme", next);
    if (next === "auto") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", next);
    }
  }

  return (
    <button onClick={cycle} style={{ fontSize: "11px" }}>
      {LABELS[theme]}
    </button>
  );
}
