import type {
  AnalysisCheckpoint,
  AnalyzeErrorResponse,
  AnalyzeResponseBody,
  FollowUpBulletResponseBody,
  OptimizationCheckpoint,
  OptimizeErrorResponse,
  OptimizeResponseBody,
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
  resumePending = false
): Promise<AnalysisResult> {
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

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input,
        optimizeStyle,
        exampleMode,
        checkpoint: pending.checkpoint,
      }),
    });
    const data = (await response.json()) as AnalyzeResponseBody | AnalyzeErrorResponse;

    if (!response.ok || !("result" in data)) {
      const checkpoint = "checkpoint" in data ? data.checkpoint : undefined;
      if (checkpoint) {
        writePendingAnalysis({ ...pending, checkpoint });
      }
      throw new ResumeAgentClientError(USER_FACING_ERROR_MESSAGE);
    }

    clearPendingAnalysis();
    return data.result;
  } catch {
    throw new ResumeAgentClientError(USER_FACING_ERROR_MESSAGE);
  }
}

export async function regenerateOptimizedItems(
  input: UserInput,
  style: OptimizeStyle,
  diagnosis: ResumeDiagnosis,
  followUpQuestions: FollowUpQuestion[] = [],
  experienceAssessments: ExperienceAssessment[] = [],
  exampleMode = false
): Promise<
  Pick<AnalysisResult, "optimizedItems" | "finalResume" | "finalResumeScore" | "interviewPrep">
> {
  const fingerprint = JSON.stringify({
    input,
    style,
    diagnosis,
    followUpQuestions,
    experienceAssessments,
    exampleMode,
  });
  let saved: PendingOptimization | null = null;
  try {
    const stored = window.sessionStorage.getItem(PENDING_OPTIMIZATION_STORAGE_KEY);
    saved = stored ? (JSON.parse(stored) as PendingOptimization) : null;
  } catch {
    // Continue without a saved checkpoint.
  }

  const pending: PendingOptimization =
    saved?.fingerprint === fingerprint
      ? saved
      : { fingerprint, checkpoint: {} };

  try {
    window.sessionStorage.setItem(PENDING_OPTIMIZATION_STORAGE_KEY, JSON.stringify(pending));
  } catch {
    // A storage failure must not prevent regeneration.
  }

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
      }),
    });
    const data = (await response.json()) as OptimizeResponseBody | OptimizeErrorResponse;

    if (!response.ok || !("optimizedItems" in data)) {
      const checkpoint = "checkpoint" in data ? data.checkpoint : undefined;
      if (checkpoint) {
        try {
          window.sessionStorage.setItem(
            PENDING_OPTIMIZATION_STORAGE_KEY,
            JSON.stringify({ ...pending, checkpoint })
          );
        } catch {
          // Continue surfacing the generic error if storage is unavailable.
        }
      }
      throw new ResumeAgentClientError(USER_FACING_ERROR_MESSAGE);
    }

    try {
      window.sessionStorage.removeItem(PENDING_OPTIMIZATION_STORAGE_KEY);
    } catch {
      // Ignore unavailable browser storage.
    }

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
