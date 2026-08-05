import type {
  AnalyzeResponseBody,
  FollowUpBulletResponseBody,
  OptimizeResponseBody,
  PerfectionResponseBody,
} from "@/lib/ai/types";
import type {
  AnalysisResult,
  FollowUpQuestion,
  MatchItem,
  OptimizeStyle,
  PerfectionPlan,
  ResumeDiagnosis,
  UserInput,
} from "@/types/resume";

export { STYLE_LABELS } from "@/lib/ai/types";

class ResumeAgentClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResumeAgentClientError";
  }
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    throw new ResumeAgentClientError(data.error || `请求失败 (${response.status})`);
  }

  return data;
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
  optimizeStyle: OptimizeStyle = "ai-product",
  exampleMode = false
): Promise<AnalysisResult> {
  const data = await postJSON<AnalyzeResponseBody>("/api/analyze", {
    input,
    optimizeStyle,
    exampleMode,
  });
  return data.result;
}

export async function regenerateOptimizedItems(
  input: UserInput,
  style: OptimizeStyle,
  diagnosis: ResumeDiagnosis,
  followUpQuestions: FollowUpQuestion[] = [],
  exampleMode = false
): Promise<Pick<AnalysisResult, "optimizedItems" | "finalResume" | "finalResumeScore">> {
  const data = await postJSON<OptimizeResponseBody>("/api/optimize", {
    input,
    style,
    followUpQuestions,
    diagnosis,
    exampleMode,
  });
  return {
    optimizedItems: data.optimizedItems,
    finalResume: data.finalResume,
    finalResumeScore: data.finalResumeScore,
  };
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
