import type {
  AnalysisCheckpoint,
  AnalysisStage,
  AnalyzeErrorResponse,
  AnalyzeStageResponseBody,
  FollowUpBulletResponseBody,
  OptimizationCheckpoint,
  OptimizationStage,
  OptimizeErrorResponse,
  OptimizeResponseBody,
  OptimizeStageResponseBody,
  PerfectionResponseBody,
} from "@/lib/ai/types";
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

export { STYLE_LABELS } from "@/lib/ai/types";

const USER_FACING_ERROR_MESSAGE = "出错，请刷新重试";
const PENDING_ANALYSIS_STORAGE_KEY = "resume-expert:pending-analysis";
const PENDING_OPTIMIZATION_STORAGE_KEY = "resume-expert:pending-optimization";

interface PendingAnalysis {
  analysisId: string;
  fingerprint: string;
  input: UserInput;
  optimizeStyle: OptimizeStyle;
  exampleMode: boolean;
  checkpoint: AnalysisCheckpoint;
}

interface PendingOptimization {
  fingerprint: string;
  checkpoint: OptimizationCheckpoint;
}

class ResumeAgentClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResumeAgentClientError";
  }
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new ResumeAgentClientError(USER_FACING_ERROR_MESSAGE);
    }

    return (await response.json()) as T;
  } catch {
    throw new ResumeAgentClientError(USER_FACING_ERROR_MESSAGE);
  }
}

function buildAnalysisFingerprint(
  input: UserInput,
  optimizeStyle: OptimizeStyle,
  exampleMode: boolean
): string {
  return JSON.stringify({ input, optimizeStyle, exampleMode });
}

function readPendingAnalysis(): PendingAnalysis | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.sessionStorage.getItem(PENDING_ANALYSIS_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as PendingAnalysis) : null;
  } catch {
    return null;
  }
}

function writePendingAnalysis(pending: PendingAnalysis): void {
  try {
    window.sessionStorage.setItem(PENDING_ANALYSIS_STORAGE_KEY, JSON.stringify(pending));
  } catch {
    // A storage failure must not prevent the analysis itself from running.
  }
}

function clearPendingAnalysis(): void {
  try {
    window.sessionStorage.removeItem(PENDING_ANALYSIS_STORAGE_KEY);
  } catch {
    // Ignore unavailable browser storage.
  }
}

export function getPendingResumeAnalysisInput(): UserInput | null {
  return readPendingAnalysis()?.input ?? null;
}

export function hasPendingResumeAnalysis(): boolean {
  return readPendingAnalysis() !== null;
}

export function discardPendingResumeAnalysis(): void {
  clearPendingAnalysis();
  try {
    window.sessionStorage.removeItem(PENDING_OPTIMIZATION_STORAGE_KEY);
  } catch {
    // Ignore unavailable browser storage.
  }
}

export async function fetchAIStatus() {
  const response = await fetch("/api/ai/status", { cache: "no-store" });
  if (!response.ok) {
    return { mode: "mock" as const };
  }
  return response.json() as Promise<{
    mode: "mock" | "llm";
    model?: string;
    provider?: string;
    reason?: "missing_api_key" | "forced";
  }>;
}

export async function runResumeAnalysis(
  input: UserInput,
  optimizeStyle: OptimizeStyle = "professional-match",
  exampleMode = false,
  resumePending = false,
  onStage?: (stage: AnalysisStage, checkpoint: AnalysisCheckpoint) => void,
  onStageStart?: (stage: AnalysisStage) => void
): Promise<AnalysisCheckpoint> {
  const fingerprint = buildAnalysisFingerprint(input, optimizeStyle, exampleMode);
  const saved = readPendingAnalysis();
  const pending: PendingAnalysis =
    resumePending && saved?.fingerprint === fingerprint
      ? saved
      : {
          analysisId:
            window.crypto?.randomUUID?.() ??
            `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          fingerprint,
          input,
          optimizeStyle,
          exampleMode,
          checkpoint: {},
        };

  writePendingAnalysis(pending);

  let checkpoint = pending.checkpoint;
  const stages: AnalysisStage[] = [
    "jd",
    "diagnosis-match",
    "experience-inventory",
    "follow-ups",
  ];
  const isAnalysisStageComplete = (stage: AnalysisStage) => {
    if (stage === "jd") return Boolean(checkpoint.jdAnalysis);
    if (stage === "diagnosis-match") {
      return Boolean(checkpoint.diagnosis && checkpoint.matchItems);
    }
    if (stage === "experience-inventory") {
      return Boolean(checkpoint.experienceAssessments);
    }
    return Boolean(checkpoint.followUpQuestions);
  };

  for (const stage of stages) {
    if (isAnalysisStageComplete(stage)) {
      onStage?.(stage, checkpoint);
      continue;
    }
    try {
      onStageStart?.(stage);
      const response = await fetch("/api/analyze/stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, stage, exampleMode, checkpoint }),
      });
      const data = (await response.json()) as AnalyzeStageResponseBody | AnalyzeErrorResponse;
      if (!response.ok || !("stage" in data)) {
        const savedCheckpoint = "checkpoint" in data ? data.checkpoint : undefined;
        if (savedCheckpoint) {
          checkpoint = { ...checkpoint, ...savedCheckpoint };
          writePendingAnalysis({ ...pending, checkpoint });
        }
        throw new ResumeAgentClientError(USER_FACING_ERROR_MESSAGE);
      }
      checkpoint = data.checkpoint;
      writePendingAnalysis({ ...pending, checkpoint });
      onStage?.(stage, checkpoint);
    } catch {
      throw new ResumeAgentClientError(USER_FACING_ERROR_MESSAGE);
    }
  }

  clearPendingAnalysis();
  return checkpoint;
}

function readPendingOptimization(): PendingOptimization | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage.getItem(PENDING_OPTIMIZATION_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as PendingOptimization) : null;
  } catch {
    return null;
  }
}

function writePendingOptimization(pending: PendingOptimization): void {
  try {
    window.sessionStorage.setItem(PENDING_OPTIMIZATION_STORAGE_KEY, JSON.stringify(pending));
  } catch {
    // A storage failure must not prevent generation.
  }
}

function clearPendingOptimization(): void {
  try {
    window.sessionStorage.removeItem(PENDING_OPTIMIZATION_STORAGE_KEY);
  } catch {
    // Ignore unavailable browser storage.
  }
}

function buildOptimizationFingerprint(
  input: UserInput,
  style: OptimizeStyle,
  diagnosis: ResumeDiagnosis,
  followUpQuestions: FollowUpQuestion[],
  experienceAssessments: ExperienceAssessment[],
  exampleMode: boolean,
  targetingContext?: ResumeTargetingContext
): string {
  return JSON.stringify({
    input,
    style,
    diagnosis,
    followUpQuestions,
    experienceAssessments,
    exampleMode,
    targetingContext,
  });
}

export async function runResumeOptimization(
  input: UserInput,
  style: OptimizeStyle,
  diagnosis: ResumeDiagnosis,
  followUpQuestions: FollowUpQuestion[] = [],
  experienceAssessments: ExperienceAssessment[] = [],
  exampleMode = false,
  onStage?: (stage: OptimizationStage, checkpoint: OptimizationCheckpoint) => void,
  onStageError?: (stage: OptimizationStage, message: string) => void,
  onStageStart?: (stage: OptimizationStage) => void,
  targetingContext?: ResumeTargetingContext
): Promise<OptimizationCheckpoint> {
  const fingerprint = buildOptimizationFingerprint(
    input,
    style,
    diagnosis,
    followUpQuestions,
    experienceAssessments,
    exampleMode,
    targetingContext
  );
  const saved = readPendingOptimization();
  const pending: PendingOptimization =
    saved?.fingerprint === fingerprint ? saved : { fingerprint, checkpoint: {} };
  let checkpoint = pending.checkpoint;

  const requestStage = async (
    stage: OptimizationStage,
    sourceCheckpoint: OptimizationCheckpoint
  ) => {
    const response = await fetch("/api/optimize/stage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input,
        style,
        stage,
        diagnosis,
        followUpQuestions,
        experienceAssessments,
        exampleMode,
        checkpoint: sourceCheckpoint,
        targetingContext,
      }),
    });
    const data = (await response.json()) as OptimizeStageResponseBody | OptimizeErrorResponse;
    if (!response.ok || !("stage" in data)) {
      const savedCheckpoint = "checkpoint" in data ? data.checkpoint : undefined;
      if (savedCheckpoint) {
        checkpoint = { ...checkpoint, ...savedCheckpoint };
        writePendingOptimization({ fingerprint, checkpoint });
      }
      throw new ResumeAgentClientError(USER_FACING_ERROR_MESSAGE);
    }
    return data.checkpoint;
  };

  const isOptimizationStageComplete = (stage: OptimizationStage) => {
    if (stage === "optimized-items") return Boolean(checkpoint.optimizedItems);
    if (stage === "final-resume") return Boolean(checkpoint.finalResume);
    if (stage === "final-score") return typeof checkpoint.finalResumeScore === "number";
    return Boolean(checkpoint.interviewPrep);
  };

  for (const stage of ["optimized-items", "final-resume"] as OptimizationStage[]) {
    if (isOptimizationStageComplete(stage)) {
      onStage?.(stage, checkpoint);
      continue;
    }
    try {
      onStageStart?.(stage);
      checkpoint = { ...checkpoint, ...(await requestStage(stage, checkpoint)) };
      writePendingOptimization({ fingerprint, checkpoint });
      onStage?.(stage, checkpoint);
    } catch (error) {
      const message = error instanceof Error ? error.message : USER_FACING_ERROR_MESSAGE;
      onStageError?.(stage, message);
      throw new ResumeAgentClientError(message);
    }
  }

  const finalBase = checkpoint;
  const lateStages = ["final-score", "interview"] as OptimizationStage[];
  const pendingLateStages = lateStages.filter((stage) => {
    if (isOptimizationStageComplete(stage)) {
      onStage?.(stage, checkpoint);
      return false;
    }
    onStageStart?.(stage);
    return true;
  });
  const lateResults = await Promise.allSettled(
    pendingLateStages.map(async (stage) => ({
      stage,
      checkpoint: await requestStage(stage, finalBase),
    }))
  );

  lateResults.forEach((result, index) => {
    const stage = pendingLateStages[index];
    if (result.status === "fulfilled") {
      checkpoint = { ...checkpoint, ...result.value.checkpoint };
      writePendingOptimization({ fingerprint, checkpoint });
      onStage?.(stage, checkpoint);
    } else {
      onStageError?.(stage, USER_FACING_ERROR_MESSAGE);
    }
  });

  if (typeof checkpoint.finalResumeScore === "number" && checkpoint.interviewPrep) {
    clearPendingOptimization();
  }
  return checkpoint;
}

export async function regenerateOptimizedItems(
  input: UserInput,
  style: OptimizeStyle,
  diagnosis: ResumeDiagnosis,
  followUpQuestions: FollowUpQuestion[] = [],
  experienceAssessments: ExperienceAssessment[] = [],
  exampleMode = false,
  targetingContext?: ResumeTargetingContext
): Promise<
  Pick<AnalysisResult, "optimizedItems" | "finalResume" | "finalResumeScore" | "interviewPrep">
> {
  const fingerprint = buildOptimizationFingerprint(
    input,
    style,
    diagnosis,
    followUpQuestions,
    experienceAssessments,
    exampleMode,
    targetingContext
  );
  const saved = readPendingOptimization();

  const pending: PendingOptimization =
    saved?.fingerprint === fingerprint
      ? saved
      : { fingerprint, checkpoint: {} };

  writePendingOptimization(pending);

  try {
    const response = await fetch("/api/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input,
        style,
        followUpQuestions,
        experienceAssessments,
        diagnosis,
        exampleMode,
        checkpoint: pending.checkpoint,
        targetingContext,
      }),
    });
    const data = (await response.json()) as OptimizeResponseBody | OptimizeErrorResponse;

    if (!response.ok || !("optimizedItems" in data)) {
      const checkpoint = "checkpoint" in data ? data.checkpoint : undefined;
      if (checkpoint) {
        writePendingOptimization({ ...pending, checkpoint });
      }
      throw new ResumeAgentClientError(USER_FACING_ERROR_MESSAGE);
    }

    clearPendingOptimization();

    return {
      optimizedItems: data.optimizedItems,
      finalResume: data.finalResume,
      finalResumeScore: data.finalResumeScore,
      interviewPrep: data.interviewPrep,
    };
  } catch {
    throw new ResumeAgentClientError(USER_FACING_ERROR_MESSAGE);
  }
}

export async function generateFollowUpBullet(
  input: UserInput,
  question: string,
  purpose: string,
  userAnswer: string,
  exampleMode = false
): Promise<string> {
  const data = await postJSON<FollowUpBulletResponseBody>("/api/follow-up/bullet", {
    input,
    question,
    purpose,
    userAnswer,
    exampleMode,
  });
  return data.bullet;
}

export async function generatePerfectionPlan(
  input: UserInput,
  diagnosis: ResumeDiagnosis,
  matchItems: MatchItem[],
  followUpQuestions: FollowUpQuestion[] = [],
  exampleMode = false
): Promise<PerfectionPlan> {
  const data = await postJSON<PerfectionResponseBody>("/api/perfection", {
    input,
    diagnosis,
    matchItems,
    followUpQuestions,
    exampleMode,
  });
  return data.plan;
}
