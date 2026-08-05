import { chatCompletionJSON } from "@/lib/ai/client";
import {
  buildPerfectionPrompt,
  normalizePerfectionPlan,
  PERFECTION_SYSTEM_PROMPT,
} from "@/lib/ai/perfection";
import {
  RESUME_AGENT_SYSTEM_PROMPT,
  buildAnalyzeCorePrompt,
  buildAnalyzeDiagnosisPrompt,
  buildAnalyzeFinalResumePrompt,
  buildAnalyzeInterviewPrompt,
  buildAnalyzeOutputPrompt,
  buildFinalResumeScorePrompt,
  buildFollowUpBulletPrompt,
  buildOptimizeUserPrompt,
  normalizeAnalysisResult,
  normalizeOptimizedItems,
} from "@/lib/ai/prompts";
import type {
  AnalysisResult,
  FollowUpQuestion,
  MatchItem,
  OptimizeStyle,
  PerfectionPlan,
  ResumeDiagnosis,
  UserInput,
} from "@/types/resume";

type JDAnalysisResult = Pick<AnalysisResult, "jdAnalysis">;
type DiagnosisMatchResult = Pick<
  AnalysisResult,
  "diagnosis" | "matchItems" | "followUpQuestions"
>;
type OptimizeResult = Pick<AnalysisResult, "optimizedItems">;
type FinalResumeResult = Pick<AnalysisResult, "finalResume">;
type FinalResumeScoreResult = { overallScore: number };
type InterviewResult = Pick<AnalysisResult, "interviewPrep">;

function buildCoreSummary(parts: DiagnosisMatchResult): string {
  return [
    `匹配度：${parts.diagnosis.overallScore}/100`,
    `主要问题：${parts.diagnosis.mainIssues.slice(0, 3).join("；") || "无"}`,
    `优先建议：${parts.diagnosis.prioritySuggestions.slice(0, 3).join("；") || "无"}`,
    `关键缺口：${parts.matchItems
      .filter((item) => item.needsSupplement)
      .slice(0, 4)
      .map((item) => item.jdRequirement)
      .join("；") || "无"}`,
  ].join("\n");
}

export async function runLLMResumeAnalysis(
  input: UserInput,
  optimizeStyle: OptimizeStyle = "ai-product"
): Promise<AnalysisResult> {
  const jd = await chatCompletionJSON<JDAnalysisResult>({
    system: RESUME_AGENT_SYSTEM_PROMPT,
    user: buildAnalyzeCorePrompt(input),
    maxTokens: 3000,
  });

  const diagnosisMatch = await chatCompletionJSON<DiagnosisMatchResult>({
    system: RESUME_AGENT_SYSTEM_PROMPT,
    user: buildAnalyzeDiagnosisPrompt(input),
    maxTokens: 16000,
  });

  const coreSummary = buildCoreSummary(diagnosisMatch);

  const [optimize, interview] = await Promise.all([
    chatCompletionJSON<OptimizeResult>({
      system: RESUME_AGENT_SYSTEM_PROMPT,
      user: buildAnalyzeOutputPrompt(input, optimizeStyle, coreSummary),
      maxTokens: 4500,
    }),
    chatCompletionJSON<InterviewResult>({
      system: RESUME_AGENT_SYSTEM_PROMPT,
      user: buildAnalyzeInterviewPrompt(input, coreSummary),
      maxTokens: 3500,
    }),
  ]);

  const finalResume = await chatCompletionJSON<FinalResumeResult>({
    system: RESUME_AGENT_SYSTEM_PROMPT,
    user: buildAnalyzeFinalResumePrompt(
      input,
      optimizeStyle,
      coreSummary,
      optimize.optimizedItems
    ),
    maxTokens: 16000,
  });

  const finalResumeScore = await chatCompletionJSON<FinalResumeScoreResult>({
    system: RESUME_AGENT_SYSTEM_PROMPT,
    user: buildFinalResumeScorePrompt(
      input,
      finalResume.finalResume,
      diagnosisMatch.diagnosis
    ),
    temperature: 0.2,
    maxTokens: 300,
  });

  const raw: AnalysisResult = {
    jdAnalysis: jd.jdAnalysis,
    diagnosis: diagnosisMatch.diagnosis,
    matchItems: diagnosisMatch.matchItems,
    followUpQuestions: diagnosisMatch.followUpQuestions,
    optimizedItems: optimize.optimizedItems,
    finalResume: finalResume.finalResume,
    finalResumeScore: finalResumeScore.overallScore,
    interviewPrep: interview.interviewPrep,
  };

  return normalizeAnalysisResult(raw, input);
}

export async function runLLMRegenerateOptimizedItems(
  input: UserInput,
  style: OptimizeStyle,
  diagnosis: ResumeDiagnosis,
  followUpQuestions: FollowUpQuestion[] = []
): Promise<Pick<AnalysisResult, "optimizedItems" | "finalResume" | "finalResumeScore">> {
  const raw = await chatCompletionJSON<{ optimizedItems: AnalysisResult["optimizedItems"] }>({
    system: RESUME_AGENT_SYSTEM_PROMPT,
    user: buildOptimizeUserPrompt(input, style, followUpQuestions),
    temperature: 0.5,
    maxTokens: 4000,
  });

  const optimizedItems = normalizeOptimizedItems(raw.optimizedItems);
  const finalResume = await chatCompletionJSON<FinalResumeResult>({
    system: RESUME_AGENT_SYSTEM_PROMPT,
    user: buildAnalyzeFinalResumePrompt(
      input,
      style,
      "",
      optimizedItems,
      followUpQuestions
    ),
    maxTokens: 16000,
  });

  const normalizedFinalResume = normalizeAnalysisResult(
    {
      finalResume: finalResume.finalResume,
    } as AnalysisResult,
    input
  ).finalResume;
  const finalResumeScore = await chatCompletionJSON<FinalResumeScoreResult>({
    system: RESUME_AGENT_SYSTEM_PROMPT,
    user: buildFinalResumeScorePrompt(input, normalizedFinalResume, diagnosis),
    temperature: 0.2,
    maxTokens: 300,
  });

  return {
    optimizedItems,
    finalResume: normalizedFinalResume,
    finalResumeScore: Math.max(0, Math.min(100, Math.round(finalResumeScore.overallScore))),
  };
}

export async function runLLMFollowUpBullet(
  input: UserInput,
  question: string,
  purpose: string,
  userAnswer: string
): Promise<string> {
  const raw = await chatCompletionJSON<{ bullet: string }>({
    system: RESUME_AGENT_SYSTEM_PROMPT,
    user: buildFollowUpBulletPrompt(input, question, purpose, userAnswer),
    temperature: 0.3,
    maxTokens: 500,
  });

  return raw.bullet?.trim() ?? "";
}

export async function runLLMPerfectionPlan(
  input: UserInput,
  diagnosis: ResumeDiagnosis,
  matchItems: MatchItem[],
  followUpQuestions: FollowUpQuestion[] = []
): Promise<PerfectionPlan> {
  const raw = await chatCompletionJSON<{ plan: PerfectionPlan }>({
    system: PERFECTION_SYSTEM_PROMPT,
    user: buildPerfectionPrompt(input, diagnosis, matchItems, followUpQuestions),
    temperature: 0.4,
    maxTokens: 5000,
  });

  return normalizePerfectionPlan(raw.plan);
}
