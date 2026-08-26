"use client";

import {
  Brain,
  Check,
  Circle,
  ClipboardList,
  Download,
  FileSearch,
  FileText,
  GitCompare,
  MessageSquare,
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
  const { currentStep, setCurrentStep, getStepStatus, analysisResult } = useResumeStore();
  const showFinalResumeScore = ["final-resume", "interview", "export", "perfection"].includes(
    currentStep
  );
  const displayedScore =
    analysisResult && showFinalResumeScore
      ? analysisResult.finalResumeScore
      : analysisResult?.diagnosis.overallScore;
  const scoreImprovement = analysisResult
    ? analysisResult.finalResumeScore - analysisResult.diagnosis.overallScore
    : 0;

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-neutral-200 bg-white md:w-56 md:border-b-0 md:border-r">
      <div className="hidden border-b border-neutral-200 px-4 py-3 md:block">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">分析流程</p>
      </div>
      <nav className="flex max-w-full gap-1 overflow-x-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:block md:flex-1 md:overflow-y-auto">
        {STEPS.map((step, index) => {
          const status = getStepStatus(step.id);
          const Icon = step.icon;
          const isDisabled = status === "disabled";

          return (
            <button
              key={step.id}
              type="button"
              disabled={isDisabled}
              onClick={() => {
                if (!isDisabled) setCurrentStep(step.id);
              }}
              className={cn(
                "flex min-w-[76px] shrink-0 flex-col items-center gap-1 rounded-md px-2 py-1.5 text-center text-xs transition-colors md:mb-0.5 md:w-full md:min-w-0 md:flex-row md:gap-2.5 md:px-3 md:py-2 md:text-left md:text-sm",
                status === "active" && "bg-neutral-100 text-neutral-900",
                status === "completed" && "text-neutral-600 hover:bg-neutral-50",
                status === "pending" && "text-neutral-500 hover:bg-neutral-50",
                status === "disabled" && "cursor-not-allowed text-neutral-300"
              )}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                {status === "completed" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : status === "active" ? (
                  <Icon className="h-3.5 w-3.5" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
              </span>
              <span className="flex-1 truncate">{step.label}</span>
              <span className="hidden text-[10px] tabular-nums text-neutral-400 md:inline">{index + 1}</span>
            </button>
          );
        })}
      </nav>
      {analysisResult && (
        <div className="hidden border-t border-neutral-200 p-3 md:block">
          <p className="text-xs text-neutral-400">
            {showFinalResumeScore ? "优化后匹配度" : "整体匹配度"}
          </p>
          <p className="text-2xl font-semibold tabular-nums text-neutral-900">
            {displayedScore}
            <span className="text-sm font-normal text-neutral-400">/100</span>
          </p>
          {showFinalResumeScore && (
            <p className="mt-1 text-xs tabular-nums text-neutral-400">
              原始 {analysisResult.diagnosis.overallScore}
              <span
                className={cn(
                  "ml-2",
                  scoreImprovement > 0 && "text-emerald-600",
                  scoreImprovement < 0 && "text-red-500"
                )}
              >
                {scoreImprovement > 0 ? `提升 +${scoreImprovement}` : `变化 ${scoreImprovement}`}
              </span>
            </p>
          )}
        </div>
      )}
    </aside>
  );
}
