"use client";

import { Loader2 } from "lucide-react";
import { useResumeStore } from "@/store/resume-store";
import { InputStep } from "@/components/steps/input-step";
import { JDAnalysisStep } from "@/components/steps/jd-analysis-step";
import { DiagnosisStep } from "@/components/steps/diagnosis-step";
import { MatchStep } from "@/components/steps/match-step";
import { FollowUpStep } from "@/components/steps/follow-up-step";
import { OptimizeStep } from "@/components/steps/optimize-step";
import { FinalResumeStep } from "@/components/steps/final-resume-step";
import { PerfectionStep } from "@/components/steps/perfection-step";
import { InterviewStep } from "@/components/steps/interview-step";
import { ExportStep } from "@/components/steps/export-step";

export function StepContent() {
  const { currentStep, runningStage } = useResumeStore();
  const stageLabels = {
    jd: "正在解析目标岗位 JD",
    "diagnosis-match": "正在生成简历诊断与匹配分析",
    "experience-inventory": "正在盘点简历经历",
    "follow-ups": "正在生成经历追问",
    "optimized-items": "正在根据追问生成优化建议",
    "final-resume": "正在生成最终简历",
    "final-score": "正在评估优化后匹配度",
    interview: "正在生成面试准备建议",
  } as const;

  let content;
  switch (currentStep) {
    case "input":
      content = <InputStep />;
      break;
    case "jd-analysis":
      content = <JDAnalysisStep />;
      break;
    case "diagnosis":
      content = <DiagnosisStep />;
      break;
    case "match":
      content = <MatchStep />;
      break;
    case "follow-up":
      content = <FollowUpStep />;
      break;
    case "optimize":
      content = <OptimizeStep />;
      break;
    case "final-resume":
      content = <FinalResumeStep />;
      break;
    case "perfection":
      content = <PerfectionStep />;
      break;
    case "interview":
      content = <InterviewStep />;
      break;
    case "export":
      content = <ExportStep />;
      break;
    default:
      content = <InputStep />;
  }

  return (
    <>
      {runningStage && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm font-medium text-primary shadow-[0_8px_24px_hsl(var(--primary)/0.08)]">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          <span>{stageLabels[runningStage]}…</span>
        </div>
      )}
      {content}
    </>
  );
}
