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
      className="flex h-7 items-center rounded-md border border-neutral-200 bg-neutral-50 p-0.5"
    >
      <button
        type="button"
        aria-pressed={theme === "light"}
        title="切换到 Light 模式"
        onClick={() => selectTheme("light")}
        className={cn(
          "flex h-5 items-center gap-1 rounded px-1.5 text-[10px] font-medium transition-colors",
          theme === "light"
            ? "bg-white text-neutral-900 shadow-sm"
            : "text-neutral-400 hover:text-neutral-700"
        )}
      >
        <Sun className="h-3 w-3" />
        Light
      </button>
      <button
        type="button"
        aria-pressed={theme === "dark"}
        title="切换到 Dark 模式"
        onClick={() => selectTheme("dark")}
        className={cn(
          "flex h-5 items-center gap-1 rounded px-1.5 text-[10px] font-medium transition-colors",
          theme === "dark"
            ? "bg-white text-neutral-900 shadow-sm"
            : "text-neutral-400 hover:text-neutral-700"
        )}
      >
        <Moon className="h-3 w-3" />
        Dark
      </button>
    </div>
  );
}
