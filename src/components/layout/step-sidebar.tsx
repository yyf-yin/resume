"use client";

import {
  Brain,
  AlertCircle,
  ArrowRight,
  Check,
  Circle,
  ClipboardList,
  Download,
  FileSearch,
  FileText,
  GitCompare,
  MessageSquare,
  Loader2,
  Rocket,
  Sparkles,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useResumeStore } from "@/store/resume-store";
import type { StepId } from "@/types/resume";

const STEPS: { id: StepId; label: string; icon: React.ElementType }[] = [
  { id: "input", label: "输入材料", icon: FileText },
  { id: "jd-analysis", label: "JD 解析", icon: FileSearch },
  { id: "diagnosis", label: "简历诊断", icon: Target },
  { id: "match", label: "匹配分析", icon: GitCompare },
  { id: "follow-up", label: "经历追问", icon: MessageSquare },
  { id: "optimize", label: "简历优化", icon: Sparkles },
  { id: "final-resume", label: "最终简历", icon: ClipboardList },
  { id: "interview", label: "面试准备", icon: Brain },
  { id: "export", label: "导出结果", icon: Download },
  { id: "perfection", label: "精益求精", icon: Rocket },
];

export function StepSidebar() {
  const {
    currentStep,
    setCurrentStep,
    getStepStatus,
    analysisCheckpoint,
    optimizationCheckpoint,
  } = useResumeStore();
  const showFinalResumeScore = ["final-resume", "interview", "export", "perfection"].includes(
    currentStep
  );
  const originalScore = analysisCheckpoint.diagnosis?.overallScore;
  const finalScore = optimizationCheckpoint.finalResumeScore;
  const scoreImprovement =
    typeof finalScore === "number" && typeof originalScore === "number"
      ? finalScore - originalScore
      : null;

  return (
    <aside className="workflow-sidebar relative z-10 flex w-full shrink-0 flex-col border-b md:w-64 md:border-b-0 md:border-r">
      <div className="hidden border-b border-primary/10 px-5 py-4 md:block">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">分析流程</p>
      </div>
      <nav className="flex max-w-full gap-1.5 overflow-x-auto p-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:block md:flex-1 md:space-y-1 md:overflow-y-auto md:p-3">
        {STEPS.map((step, index) => {
          const status = getStepStatus(step.id);
          const Icon = step.icon;
          const isDisabled = status === "disabled" || status === "running" || status === "error";

          return (
            <button
              key={step.id}
              type="button"
              disabled={isDisabled}
              onClick={() => {
                if (!isDisabled) setCurrentStep(step.id);
              }}
              className={cn(
                "group flex min-w-[80px] shrink-0 flex-col items-center gap-1 rounded-lg border border-transparent px-2 py-2 text-center text-xs transition-all duration-200 md:w-full md:min-w-0 md:flex-row md:gap-2.5 md:px-3 md:py-2.5 md:text-left md:text-sm",
                status === "active" && "border-primary/25 bg-primary text-primary-foreground shadow-[0_8px_24px_hsl(var(--primary)/0.24)] md:translate-x-1",
                status === "completed" && "text-foreground/75 hover:border-primary/15 hover:bg-primary/5 hover:text-primary",
                status === "pending" && "text-muted-foreground hover:border-primary/10 hover:bg-primary/5 hover:text-primary",
                status === "disabled" && "cursor-not-allowed text-neutral-300",
                status === "running" && "cursor-wait border-primary/20 bg-primary/10 text-primary",
                status === "error" && "cursor-not-allowed bg-red-50 text-red-500"
              )}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                {status === "completed" ? (
                  <Check className="h-3.5 w-3.5 text-primary" />
                ) : status === "active" ? (
                  <Icon className="h-3.5 w-3.5" />
                ) : status === "running" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : status === "error" ? (
                  <AlertCircle className="h-3.5 w-3.5" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
              </span>
              <span className="flex-1 truncate">{step.label}</span>
              <span className={cn("hidden text-[10px] tabular-nums md:inline", status === "active" ? "text-primary-foreground/70" : "text-muted-foreground/60")}>{String(index + 1).padStart(2, "0")}</span>
            </button>
          );
        })}
      </nav>
      {typeof originalScore === "number" && (
        <div className="hidden border-t border-primary/10 bg-primary/[0.025] p-4 md:block">
          {showFinalResumeScore && typeof finalScore === "number" ? (
            <>
              <p className="text-xs text-neutral-400">匹配度变化</p>
              <div className="mt-1 flex items-end gap-1.5 tabular-nums">
                <div>
                  <p className="text-[10px] text-neutral-400">原始</p>
                  <p className="text-xl font-semibold text-neutral-500">{originalScore}</p>
                </div>
                <ArrowRight className="mb-1 h-3.5 w-3.5 text-neutral-300" />
                <div>
                  <p className="text-[10px] text-emerald-600">优化后</p>
                  <p className="text-2xl font-semibold text-emerald-700">{finalScore}</p>
                </div>
                <span className="mb-1 text-xs text-neutral-400">/100</span>
              </div>
              <p
                className={cn(
                  "mt-1 text-xs tabular-nums",
                  scoreImprovement !== null && scoreImprovement > 0
                    ? "text-emerald-600"
                    : "text-neutral-400"
                )}
              >
                {scoreImprovement !== null && scoreImprovement > 0
                  ? `提升 +${scoreImprovement} 分`
                  : `变化 ${scoreImprovement ?? 0} 分`}
              </p>
            </>
          ) : (
            <>
              <p className="text-xs text-neutral-400">原始匹配度</p>
              <p className="text-2xl font-semibold tabular-nums text-neutral-900">
                {originalScore}
                <span className="text-sm font-normal text-neutral-400">/100</span>
              </p>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
