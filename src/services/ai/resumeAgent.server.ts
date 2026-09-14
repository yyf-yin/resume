import { getAIConfig } from "@/lib/ai/config";
import type {
  AIMode,
  AnalysisCheckpoint,
  AnalysisStage,
  OptimizationCheckpoint,
  OptimizationStage,
} from "@/lib/ai/types";
import {
  runMockFollowUpBullet,
  runMockPerfectionPlan,
  runMockRegenerateOptimizedItems,
  runMockResumeAnalysis,
  runMockResumeAnalysisStage,
  runMockResumeOptimizationStage,
} from "@/services/ai/resumeAgent.mock";
import {
  runLLMFollowUpBullet,
  runLLMPerfectionPlan,
  runLLMRegenerateOptimizedItems,
  runLLMResumeAnalysis,
  runLLMResumeAnalysisStage,
  runLLMResumeOptimizationStage,
} from "@/services/ai/resumeAgent.llm";
import type {
  AnalysisResult,
  ExperienceAssessment,
  FollowUpQuestion,
  MatchItem,
  OptimizeStyle,
  PerfectionPlan,
  ResumeDiagnosis,
  ResumeTargetingContext,
  UserInput,
} from "@/types/resume";

function currentMode(forceMock = false): AIMode {
  return forceMock ? "mock" : getAIConfig().mode;
}

export async function analyzeResumeStageServer(
  input: UserInput,
  stage: AnalysisStage,
  forceMock = false,
  checkpoint: AnalysisCheckpoint = {}
): Promise<{ checkpoint: AnalysisCheckpoint; mode: AIMode }> {
  const mode = currentMode(forceMock);
  const nextCheckpoint =
    mode === "llm"
      ? await runLLMResumeAnalysisStage(input, stage, checkpoint)
      : await runMockResumeAnalysisStage(input, stage, checkpoint);
  return { checkpoint: nextCheckpoint, mode };
}

export async function optimizeResumeStageServer(
  input: UserInput,
  style: OptimizeStyle,
  diagnosis: ResumeDiagnosis,
  followUpQuestions: FollowUpQuestion[],
  experienceAssessments: ExperienceAssessment[],
  stage: OptimizationStage,
  forceMock = false,
  checkpoint: OptimizationCheckpoint = {},
  targetingContext?: ResumeTargetingContext
): Promise<{ checkpoint: OptimizationCheckpoint; mode: AIMode }> {
  const mode = currentMode(forceMock);
  const nextCheckpoint =
    mode === "llm"
      ? await runLLMResumeOptimizationStage(
          input,
          style,
          diagnosis,
          followUpQuestions,
          experienceAssessments,
          stage,
          checkpoint,
          targetingContext
        )
      : await runMockResumeOptimizationStage(
          input,
          style,
          stage,
          experienceAssessments,
          checkpoint
        );
  return { checkpoint: nextCheckpoint, mode };
}

export async function analyzeResumeServer(
  input: UserInput,
  optimizeStyle: OptimizeStyle = "professional-match",
  forceMock = false,
  checkpoint: AnalysisCheckpoint = {}
): Promise<{ result: AnalysisResult; mode: AIMode }> {
  const mode = currentMode(forceMock);

  if (mode === "llm") {
    const result = await runLLMResumeAnalysis(input, optimizeStyle, checkpoint);
    return { result, mode };
  }

  const result = await runMockResumeAnalysis(input, optimizeStyle);
  return { result, mode };
}

export async function regenerateOptimizedItemsServer(
  input: UserInput,
  style: OptimizeStyle,
  diagnosis: ResumeDiagnosis,
  followUpQuestions: FollowUpQuestion[] = [],
  experienceAssessments: ExperienceAssessment[] = [],
  forceMock = false,
  checkpoint: OptimizationCheckpoint = {},
  targetingContext?: ResumeTargetingContext
): Promise<{
  optimizedItems: AnalysisResult["optimizedItems"];
  finalResume: AnalysisResult["finalResume"];
  finalResumeScore: number;
  interviewPrep: AnalysisResult["interviewPrep"];
  mode: AIMode;
}> {
  const mode = currentMode(forceMock);

  if (mode === "llm") {
    const result = await runLLMRegenerateOptimizedItems(
      input,
      style,
      diagnosis,
      followUpQuestions,
      experienceAssessments,
      checkpoint,
      targetingContext
    );
    return { ...result, mode };
  }

  const result = await runMockRegenerateOptimizedItems(
    input,
    style,
    followUpQuestions,
    experienceAssessments
  );
  return { ...result, mode };
}

export async function generateFollowUpBulletServer(
  input: UserInput,
  question: string,
  purpose: string,
  userAnswer: string,
  forceMock = false
): Promise<{ bullet: string; mode: AIMode }> {
  const mode = currentMode(forceMock);

  if (mode === "llm") {
    const bullet = await runLLMFollowUpBullet(input, question, purpose, userAnswer);
    return { bullet, mode };
  }

  const bullet = await runMockFollowUpBullet(purpose, userAnswer);
  return { bullet, mode };
}

export async function generatePerfectionPlanServer(
  input: UserInput,
  diagnosis: ResumeDiagnosis,
  matchItems: MatchItem[],
  followUpQuestions: FollowUpQuestion[] = [],
  forceMock = false
): Promise<{ plan: PerfectionPlan; mode: AIMode }> {
  const mode = currentMode(forceMock);

  if (mode === "llm") {
    const plan = await runLLMPerfectionPlan(input, diagnosis, matchItems, followUpQuestions);
    return { plan, mode };
  }

  const plan = await runMockPerfectionPlan(input, diagnosis, matchItems);
  return { plan, mode };
}
