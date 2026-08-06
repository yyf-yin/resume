"use client";

import { useEffect } from "react";
import { StepSidebar } from "@/components/layout/step-sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { StepContent } from "@/components/steps/step-content";
import { useResumeStore } from "@/store/resume-store";

const WORKFLOW_STORAGE_KEY = "resume-expert:workflow";

export function AppShell() {
  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(WORKFLOW_STORAGE_KEY);
      if (stored) {
        useResumeStore.setState({
          ...JSON.parse(stored),
          isAnalyzing: false,
          isGeneratingPerfection: false,
          copied: false,
        });
      }
    } catch {
      // Ignore unavailable or invalid session storage.
    }

    return useResumeStore.subscribe((state) => {
      try {
        if (!state.analysisResult) {
          window.sessionStorage.removeItem(WORKFLOW_STORAGE_KEY);
          return;
        }

        window.sessionStorage.setItem(
          WORKFLOW_STORAGE_KEY,
          JSON.stringify({
            userInput: state.userInput,
            currentStep: state.currentStep,
            analysisResult: state.analysisResult,
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
    <div className="flex h-screen flex-col overflow-hidden">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <StepSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl p-6">
            <StepContent />
          </div>
        </main>
      </div>
    </div>
  );
}
