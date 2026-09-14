"use client";

import Image from "next/image";
import { useEffect } from "react";
import { StepSidebar } from "@/components/layout/step-sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { StepContent } from "@/components/steps/step-content";
import { useResumeStore } from "@/store/resume-store";
import type { AnalysisResult } from "@/types/resume";

const WORKFLOW_STORAGE_KEY = "resume-expert:workflow";

export function AppShell() {
  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(WORKFLOW_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, unknown> & {
          analysisResult?: AnalysisResult | null;
        };
        if (parsed.analysisResult && !parsed.analysisCheckpoint) {
          const result = parsed.analysisResult;
          parsed.analysisCheckpoint = {
            jdAnalysis: result.jdAnalysis,
            diagnosis: result.diagnosis,
            matchItems: result.matchItems,
            experienceAssessments: result.experienceAssessments,
            followUpQuestions: result.followUpQuestions,
          };
          parsed.optimizationCheckpoint = {
            optimizedItems: result.optimizedItems,
            finalResume: result.finalResume,
            finalResumeScore: result.finalResumeScore,
            interviewPrep: result.interviewPrep,
          };
        }
        useResumeStore.setState({
          ...parsed,
          isAnalyzing: false,
          isOptimizing: false,
          runningStage: null,
          isGeneratingPerfection: false,
          copied: false,
        });
      }
    } catch {
      // Ignore unavailable or invalid session storage.
    }

    return useResumeStore.subscribe((state) => {
      try {
        if (
          Object.keys(state.analysisCheckpoint).length === 0 &&
          Object.keys(state.optimizationCheckpoint).length === 0
        ) {
          window.sessionStorage.removeItem(WORKFLOW_STORAGE_KEY);
          return;
        }

        window.sessionStorage.setItem(
          WORKFLOW_STORAGE_KEY,
          JSON.stringify({
            userInput: state.userInput,
            currentStep: state.currentStep,
            analysisResult: state.analysisResult,
            analysisCheckpoint: state.analysisCheckpoint,
            optimizationCheckpoint: state.optimizationCheckpoint,
            stageErrors: state.stageErrors,
            optimizationCache: state.optimizationCache,
            analysisError: state.analysisError,
            perfectionPlan: state.perfectionPlan,
            perfectionError: state.perfectionError,
            aiMode: state.aiMode,
            exampleMode: state.exampleMode,
            optimizeStyle: state.optimizeStyle,
          })
        );
      } catch {
        // A storage failure must not interrupt the current workflow.
      }
    });
  }, []);

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden">
      <TopNav />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        <StepSidebar />
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto max-w-5xl p-3 pb-6 sm:p-6">
            <StepContent />
          </div>
        </main>
      </div>
      <footer className="flex shrink-0 flex-col items-center justify-center gap-1 border-t border-neutral-200 bg-white px-3 pb-[calc(0.25rem+env(safe-area-inset-bottom))] pt-1 text-[10px] leading-none text-neutral-500 sm:px-4 sm:text-[11px]">
        <a
          href="https://beian.miit.gov.cn/"
          target="_blank"
          rel="noreferrer"
          className="transition-colors hover:text-neutral-900"
        >
          苏ICP备2026058202号
        </a>
        <a
          href="https://beian.mps.gov.cn/#/query/webSearch?code=32011602010755"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 transition-colors hover:text-neutral-900"
        >
          <Image
            src="/beian-icon.png"
            alt=""
            width={14}
            height={14}
            aria-hidden="true"
          />
          苏公网安备32011602010755号
        </a>
      </footer>
    </div>
  );
}
