"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "resume-expert-theme";

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const initialTheme: Theme = savedTheme === "dark" ? "dark" : "light";
    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  const selectTheme = (nextTheme: Theme) => {
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  };

  return (
    <div
      role="group"
      aria-label="界面主题"
      className="glass-control flex h-8 items-center rounded-lg border p-0.5"
    >
      <button
        type="button"
        aria-pressed={theme === "light"}
        title="切换到 Light 模式"
        onClick={() => selectTheme("light")}
        className={cn(
          "flex h-5 w-6 items-center justify-center gap-1 rounded text-[10px] font-medium transition-colors sm:w-auto sm:px-1.5",
          theme === "light"
            ? "bg-card text-primary shadow-sm ring-1 ring-primary/15"
            : "text-muted-foreground hover:text-primary"
        )}
      >
        <Sun className="h-3 w-3" />
        <span className="hidden sm:inline">Light</span>
      </button>
      <button
        type="button"
        aria-pressed={theme === "dark"}
        title="切换到 Dark 模式"
        onClick={() => selectTheme("dark")}
        className={cn(
          "flex h-5 w-6 items-center justify-center gap-1 rounded text-[10px] font-medium transition-colors sm:w-auto sm:px-1.5",
          theme === "dark"
            ? "bg-card text-primary shadow-sm ring-1 ring-primary/15"
            : "text-muted-foreground hover:text-primary"
        )}
      >
        <Moon className="h-3 w-3" />
        <span className="hidden sm:inline">Dark</span>
      </button>
    </div>
  );
}
