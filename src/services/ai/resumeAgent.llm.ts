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
  optimizeStyle: OptimizeStyle = "professional-match"
): Promise<AnalysisResult> {
  const jd = await chatCompletionJSON<JDAnalysisResult>({
    operation: "analyze:jd",
    system: RESUME_AGENT_SYSTEM_PROMPT,
    user: buildAnalyzeCorePrompt(input),
    maxTokens: 4500,
  });

  const diagnosisMatch = await chatCompletionJSON<DiagnosisMatchResult>({
    operation: "analyze:diagnosis-match-followups",
    system: RESUME_AGENT_SYSTEM_PROMPT,
    user: buildAnalyzeDiagnosisPrompt(input),
    maxTokens: 16000,
  });

  const coreSummary = buildCoreSummary(diagnosisMatch);

  const optimize = await chatCompletionJSON<OptimizeResult>({
    operation: "analyze:optimization",
    system: RESUME_AGENT_SYSTEM_PROMPT,
    user: buildAnalyzeOutputPrompt(input, optimizeStyle, coreSummary),
    maxTokens: 12000,
  });

  const finalResume = await chatCompletionJSON<FinalResumeResult>({
    operation: "analyze:final-resume",
    system: RESUME_AGENT_SYSTEM_PROMPT,
    user: buildAnalyzeFinalResumePrompt(
      input,
      optimizeStyle,
      coreSummary,
      optimize.optimizedItems
    ),
    maxTokens: 16000,
  });

  const normalizedFinalResume = normalizeAnalysisResult(
    {
      finalResume: finalResume.finalResume,
    } as AnalysisResult,
    input
  ).finalResume;

  const [finalResumeScore, interview] = await Promise.all([
    chatCompletionJSON<FinalResumeScoreResult>({
      operation: "analyze:final-score",
      system: RESUME_AGENT_SYSTEM_PROMPT,
      user: buildFinalResumeScorePrompt(input, normalizedFinalResume, diagnosisMatch.diagnosis),
      temperature: 0.2,
      maxTokens: 3000,
    }),
    chatCompletionJSON<InterviewResult>({
      operation: "analyze:interview",
      system: RESUME_AGENT_SYSTEM_PROMPT,
      user: buildAnalyzeInterviewPrompt(
        input,
        coreSummary,
        normalizedFinalResume,
        optimize.optimizedItems
      ),
      maxTokens: 12000,
    }),
  ]);

  const raw: AnalysisResult = {
    jdAnalysis: jd.jdAnalysis,
    diagnosis: diagnosisMatch.diagnosis,
    matchItems: diagnosisMatch.matchItems,
    followUpQuestions: diagnosisMatch.followUpQuestions,
    optimizedItems: optimize.optimizedItems,
    finalResume: normalizedFinalResume,
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
): Promise<
  Pick<AnalysisResult, "optimizedItems" | "finalResume" | "finalResumeScore" | "interviewPrep">
> {
  const raw = await chatCompletionJSON<{ optimizedItems: AnalysisResult["optimizedItems"] }>({
    operation: "regenerate:optimization",
    system: RESUME_AGENT_SYSTEM_PROMPT,
    user: buildOptimizeUserPrompt(input, style, followUpQuestions),
    temperature: 0.5,
    maxTokens: 12000,
  });

  const optimizedItems = normalizeOptimizedItems(raw.optimizedItems);
  const finalResume = await chatCompletionJSON<FinalResumeResult>({
    operation: "regenerate:final-resume",
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
  const [finalResumeScore, interview] = await Promise.all([
    chatCompletionJSON<FinalResumeScoreResult>({
      operation: "regenerate:final-score",
      system: RESUME_AGENT_SYSTEM_PROMPT,
      user: buildFinalResumeScorePrompt(input, normalizedFinalResume, diagnosis),
      temperature: 0.2,
      maxTokens: 3000,
    }),
    chatCompletionJSON<InterviewResult>({
      operation: "regenerate:interview",
      system: RESUME_AGENT_SYSTEM_PROMPT,
      user: buildAnalyzeInterviewPrompt(
        input,
        "",
        normalizedFinalResume,
        optimizedItems,
        followUpQuestions
      ),
      maxTokens: 12000,
    }),
  ]);

  return {
    optimizedItems,
    finalResume: normalizedFinalResume,
    finalResumeScore: Math.max(0, Math.min(100, Math.round(finalResumeScore.overallScore))),
    interviewPrep: interview.interviewPrep,
  };
}

export async function runLLMFollowUpBullet(
  input: UserInput,
  question: string,
  purpose: string,
  userAnswer: string
): Promise<string> {
  const raw = await chatCompletionJSON<{ bullet: string }>({
    operation: "follow-up:bullet",
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
    operation: "perfection:recommendations",
    system: PERFECTION_SYSTEM_PROMPT,
    user: buildPerfectionPrompt(input, diagnosis, matchItems, followUpQuestions),
    temperature: 0.4,
    maxTokens: 5000,
  });

  return normalizePerfectionPlan(raw.plan);
}
