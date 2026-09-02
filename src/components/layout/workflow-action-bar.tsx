"use client";

import { useEffect } from "react";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  discardPendingResumeAnalysis,
  getPendingResumeAnalysisInput,
  hasPendingResumeAnalysis,
  runResumeAnalysis,
} from "@/services/ai/resumeAgent";
import { useResumeStore } from "@/store/resume-store";
import type { AnalysisStage } from "@/lib/ai/types";

export function WorkflowActionBar() {
  const {
    userInput,
    setUserInput,
    isAnalyzing,
    hasPendingAnalysis,
    setHasPendingAnalysis,
    analysisCheckpoint,
    optimizationCheckpoint,
    setAnalyzing,
    setAnalysisCheckpoint,
    setRunningStage,
    setStageError,
    resetAnalysisProgress,
    setAnalysisError,
    setCurrentStep,
    exampleMode,
  } = useResumeStore();

  useEffect(() => {
    const pendingInput = getPendingResumeAnalysisInput();
    if (pendingInput) setUserInput(pendingInput);
    setHasPendingAnalysis(hasPendingResumeAnalysis());
  }, [setHasPendingAnalysis, setUserInput]);

  const handleAnalyze = async (resumePending = false) => {
    const input = resumePending ? getPendingResumeAnalysisInput() ?? userInput : userInput;
    if (!input.targetRole || !input.jobDescription || !input.originalResume) return;

    if (resumePending) setUserInput(input);
    setAnalyzing(true, !resumePending);
    setAnalysisError(null);
    let activeStage: AnalysisStage = "jd";

    try {
      await runResumeAnalysis(
        input,
        "professional-match",
        exampleMode,
        resumePending,
        (stage, checkpoint) => {
          setAnalysisCheckpoint(checkpoint);
          setStageError(stage, null);
          if (stage === "jd") setCurrentStep("jd-analysis");
        },
        (stage) => {
          activeStage = stage;
          setRunningStage(stage);
        }
      );
      setHasPendingAnalysis(false);
    } catch (error) {
      setHasPendingAnalysis(hasPendingResumeAnalysis());
      const message = error instanceof Error ? error.message : "分析失败，请稍后重试";
      setAnalysisError(message);
      setStageError(activeStage, message);
    } finally {
      setRunningStage(null);
      setAnalyzing(false);
    }
  };

  const handleRestart = () => {
    if (!window.confirm("是否确认放弃当前进度重新开始")) return;
    discardPendingResumeAnalysis();
    setHasPendingAnalysis(false);
    resetAnalysisProgress();
  };

  const canAnalyze = Boolean(
    userInput.targetRole.trim() &&
      userInput.jobDescription.trim() &&
      userInput.originalResume.trim()
  );
  const hasAnalysisProgress =
    hasPendingAnalysis ||
    Object.keys(analysisCheckpoint).length > 0 ||
    Object.keys(optimizationCheckpoint).length > 0;

  const handlePrimaryAction = () => {
    if (hasPendingAnalysis) {
      void handleAnalyze(true);
    } else if (hasAnalysisProgress && analysisCheckpoint.jdAnalysis) {
      setCurrentStep("jd-analysis");
    } else {
      void handleAnalyze(false);
    }
  };

  return (
    <div className="flex items-center gap-2" role="toolbar" aria-label="简历分析操作">
      <Button
        size="sm"
        onClick={handlePrimaryAction}
        disabled={(!hasAnalysisProgress && !canAnalyze) || isAnalyzing}
      >
        {isAnalyzing ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            分析中...
          </>
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5" />
            {hasAnalysisProgress ? "继续分析" : "开始分析"}
          </>
        )}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleRestart}
        disabled={!hasAnalysisProgress || isAnalyzing}
      >
        <RotateCcw className="h-3.5 w-3.5" />
        重新开始
      </Button>
    </div>
  );
}
