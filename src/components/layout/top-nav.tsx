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
import { WorkflowActionBar } from "@/components/layout/workflow-action-bar";
import { cn } from "@/lib/utils";
import { useResumeStore } from "@/store/resume-store";

export function TopNav() {
  const { exampleMode, isAnalyzing, isOptimizing, setExampleMode } = useResumeStore();
  const [exampleNoticeOpen, setExampleNoticeOpen] = useState(false);
  const workflowRunning = isAnalyzing || isOptimizing;

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
    <header className="app-header relative z-20 grid shrink-0 grid-cols-1 border-b lg:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex h-14 min-w-0 items-center gap-2 px-3 sm:gap-3 sm:px-5">
        <div className="brand-mark flex h-8 w-8 items-center justify-center rounded-lg border">
          <FileText className="h-4 w-4 text-white" />
        </div>
        <div>
          <h1 className="brand-title text-sm font-bold tracking-tight sm:text-base">简历助手</h1>
        </div>
        <span className="hidden rounded-full border border-primary/20 bg-primary/5 px-2 py-1 text-[10px] font-semibold tracking-wide text-primary sm:inline-flex">
          JD 定制简历优化 Agent
        </span>
        <div
          role="group"
          aria-label="示例模式"
          className="glass-control flex h-8 shrink-0 items-center gap-0.5 rounded-lg border p-0.5 sm:gap-1 sm:pl-2"
        >
          <span className="hidden text-[10px] font-medium text-neutral-500 sm:inline">示例模式：</span>
          <button
            type="button"
            aria-pressed={exampleMode}
            disabled={workflowRunning}
            onClick={enableExampleMode}
            className={cn(
              "flex h-5 items-center rounded px-1.5 text-[10px] font-medium transition-colors",
              workflowRunning
                ? "cursor-not-allowed text-neutral-300"
                : exampleMode
                ? "bg-card text-primary shadow-sm ring-1 ring-primary/15"
                : "text-muted-foreground hover:text-primary"
            )}
          >
            开
          </button>
          <button
            type="button"
            aria-pressed={!exampleMode}
            disabled={workflowRunning}
            onClick={disableExampleMode}
            className={cn(
              "flex h-5 items-center rounded px-1.5 text-[10px] font-medium transition-colors",
              workflowRunning
                ? "cursor-not-allowed text-neutral-300"
                : !exampleMode
                ? "bg-card text-primary shadow-sm ring-1 ring-primary/15"
                : "text-muted-foreground hover:text-primary"
            )}
          >
            关
          </button>
        </div>
        <ThemeToggle />
      </div>
      <div className="flex h-12 items-center justify-end gap-4 border-t border-primary/10 px-3 sm:px-5 lg:h-14 lg:border-t-0 lg:pl-0">
        <p className="hidden text-xs text-neutral-400 2xl:block">
          基于目标岗位 JD · 诊断 · 匹配 · 优化 · 面试准备
        </p>
        <WorkflowActionBar />
      </div>

      <Dialog open={exampleNoticeOpen} onOpenChange={setExampleNoticeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>开启示例模式</DialogTitle>
            <DialogDescription>
              示例模式下仅可使用示例数据，这样会丢失已有进度，是否确认
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
