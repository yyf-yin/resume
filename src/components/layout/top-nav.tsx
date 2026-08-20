"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { cn } from "@/lib/utils";
import { useResumeStore } from "@/store/resume-store";

export function TopNav() {
  const { exampleMode, setExampleMode } = useResumeStore();
  const [exampleNoticeOpen, setExampleNoticeOpen] = useState(false);

  const enableExampleMode = () => {
    if (exampleMode) return;
    setExampleNoticeOpen(true);
  };

  const confirmExampleMode = () => {
    setExampleMode(true);
    setExampleNoticeOpen(false);
  };

  const disableExampleMode = () => {
    if (!exampleMode) return;
    setExampleMode(false);
  };

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50">
          <FileText className="h-3.5 w-3.5 text-neutral-700" />
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-neutral-900">简历助手</h1>
        </div>
        <span className="rounded-md border border-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">
          JD 定制简历优化 Agent
        </span>
        <div
          role="group"
          aria-label="示例模式"
          className="flex h-7 items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 p-0.5 pl-2"
        >
          <span className="text-[10px] font-medium text-neutral-500">示例模式：</span>
          <button
            type="button"
            aria-pressed={exampleMode}
            onClick={enableExampleMode}
            className={cn(
              "flex h-5 items-center rounded px-1.5 text-[10px] font-medium transition-colors",
              exampleMode
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-400 hover:text-neutral-700"
            )}
          >
            开
          </button>
          <button
            type="button"
            aria-pressed={!exampleMode}
            onClick={disableExampleMode}
            className={cn(
              "flex h-5 items-center rounded px-1.5 text-[10px] font-medium transition-colors",
              !exampleMode
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-400 hover:text-neutral-700"
            )}
          >
            关
          </button>
        </div>
        <ThemeToggle />
      </div>
      <p className="hidden text-xs text-neutral-400 sm:block">
        基于目标岗位 JD · 诊断 · 匹配 · 优化 · 面试准备
      </p>

      <Dialog open={exampleNoticeOpen} onOpenChange={setExampleNoticeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>开启示例模式</DialogTitle>
            <DialogDescription>
              示例模式下仅可使用示例数据，这样会丢失已有进度，是否确认
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="outline" size="sm">取消</Button>
            </DialogClose>
            <Button size="sm" onClick={confirmExampleMode}>确认切换</Button>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
