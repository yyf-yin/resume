import { chatCompletionJSON } from "@/lib/ai/client";
import {
  AnalysisCheckpointError,
  OptimizationCheckpointError,
} from "@/lib/ai/errors";
import type { AnalysisCheckpoint, OptimizationCheckpoint } from "@/lib/ai/types";
import {
  buildPerfectionPrompt,
  normalizePerfectionPlan,
  PERFECTION_SYSTEM_PROMPT,
} from "@/lib/ai/perfection";
import {
  RESUME_AGENT_SYSTEM_PROMPT,
  buildAnalyzeCorePrompt,
  buildAnalyzeDiagnosisPrompt,
  buildAnalyzeFollowUpPrompt,
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
type DiagnosisMatchResult = Pick<AnalysisResult, "diagnosis" | "matchItems">;
type FollowUpResult = Pick<AnalysisResult, "followUpQuestions">;
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

async function runAnalysisStage<T>(
  checkpoint: AnalysisCheckpoint,
  request: () => Promise<T>
): Promise<T> {
  try {
    return await request();
  } catch (error) {
    throw new AnalysisCheckpointError(error, checkpoint);
  }
}

export async function runLLMResumeAnalysis(
  input: UserInput,
  optimizeStyle: OptimizeStyle = "professional-match",
  savedCheckpoint: AnalysisCheckpoint = {}
): Promise<AnalysisResult> {
  const checkpoint: AnalysisCheckpoint = { ...savedCheckpoint };

  if (!checkpoint.jdAnalysis) {
    const jd = await runAnalysisStage(checkpoint, () =>
      chatCompletionJSON<JDAnalysisResult>({
        operation: "analyze:jd",
        system: RESUME_AGENT_SYSTEM_PROMPT,
        user: buildAnalyzeCorePrompt(input),
        maxTokens: 12000,
      })
    );
    checkpoint.jdAnalysis = jd.jdAnalysis;
  }

  if (!checkpoint.diagnosis || !checkpoint.matchItems) {
    const diagnosisMatch = await runAnalysisStage(checkpoint, () =>
      chatCompletionJSON<DiagnosisMatchResult>({
        operation: "analyze:diagnosis-match",
        system: RESUME_AGENT_SYSTEM_PROMPT,
        user: buildAnalyzeDiagnosisPrompt(input),
        maxTokens: 16000,
      })
    );
    checkpoint.diagnosis = diagnosisMatch.diagnosis;
    checkpoint.matchItems = diagnosisMatch.matchItems;
  }

  if (!checkpoint.followUpQuestions) {
    const followUps = await runAnalysisStage(checkpoint, () =>
      chatCompletionJSON<FollowUpResult>({
        operation: "analyze:followups",
        system: RESUME_AGENT_SYSTEM_PROMPT,
        user: buildAnalyzeFollowUpPrompt(
          input,
          checkpoint.diagnosis!,
          checkpoint.matchItems!
        ),
        maxTokens: 5000,
      })
    );
    checkpoint.followUpQuestions = followUps.followUpQuestions;
  }

  const diagnosisMatch: DiagnosisMatchResult = {
    diagnosis: checkpoint.diagnosis,
    matchItems: checkpoint.matchItems,
  };

  const coreSummary = buildCoreSummary(diagnosisMatch);

  if (!checkpoint.optimizedItems) {
    const optimize = await runAnalysisStage(checkpoint, () =>
      chatCompletionJSON<OptimizeResult>({
        operation: "analyze:optimization",
        system: RESUME_AGENT_SYSTEM_PROMPT,
        user: buildAnalyzeOutputPrompt(input, optimizeStyle, coreSummary),
        maxTokens: 12000,
      })
    );
    checkpoint.optimizedItems = optimize.optimizedItems;
  }

  if (!checkpoint.finalResume) {
    const finalResume = await runAnalysisStage(checkpoint, () =>
      chatCompletionJSON<FinalResumeResult>({
        operation: "analyze:final-resume",
        system: RESUME_AGENT_SYSTEM_PROMPT,
        user: buildAnalyzeFinalResumePrompt(
          input,
          optimizeStyle,
          coreSummary,
          checkpoint.optimizedItems!
        ),
        maxTokens: 16000,
      })
    );
    checkpoint.finalResume = normalizeAnalysisResult(
      {
        finalResume: finalResume.finalResume,
      } as AnalysisResult,
      input
    ).finalResume;
  }

  const scoreRequest =
    typeof checkpoint.finalResumeScore === "number"
      ? Promise.resolve<FinalResumeScoreResult | null>(null)
      : chatCompletionJSON<FinalResumeScoreResult>({
          operation: "analyze:final-score",
          system: RESUME_AGENT_SYSTEM_PROMPT,
          user: buildFinalResumeScorePrompt(
            input,
            checkpoint.finalResume,
            diagnosisMatch.diagnosis
          ),
          temperature: 0.2,
          maxTokens: 4500,
        });
  const interviewRequest = checkpoint.interviewPrep
    ? Promise.resolve<InterviewResult | null>(null)
    : chatCompletionJSON<InterviewResult>({
        operation: "analyze:interview",
        system: RESUME_AGENT_SYSTEM_PROMPT,
        user: buildAnalyzeInterviewPrompt(
          input,
          coreSummary,
          checkpoint.finalResume,
          checkpoint.optimizedItems
        ),
        maxTokens: 12000,
      });

  const [scoreResult, interviewResult] = await Promise.allSettled([
    scoreRequest,
    interviewRequest,
  ]);

  if (scoreResult.status === "fulfilled" && scoreResult.value) {
    checkpoint.finalResumeScore = scoreResult.value.overallScore;
  }
  if (interviewResult.status === "fulfilled" && interviewResult.value) {
    checkpoint.interviewPrep = interviewResult.value.interviewPrep;
  }

  const finalStageError =
    scoreResult.status === "rejected"
      ? scoreResult.reason
      : interviewResult.status === "rejected"
        ? interviewResult.reason
        : null;
  if (finalStageError) {
    throw new AnalysisCheckpointError(finalStageError, checkpoint);
  }

  const raw: AnalysisResult = {
    jdAnalysis: checkpoint.jdAnalysis,
    diagnosis: diagnosisMatch.diagnosis,
    matchItems: diagnosisMatch.matchItems,
    followUpQuestions: checkpoint.followUpQuestions,
    optimizedItems: checkpoint.optimizedItems,
    finalResume: checkpoint.finalResume,
    finalResumeScore: checkpoint.finalResumeScore!,
    interviewPrep: checkpoint.interviewPrep!,
  };

  return normalizeAnalysisResult(raw, input);
}

export async function runLLMRegenerateOptimizedItems(
  input: UserInput,
  style: OptimizeStyle,
  diagnosis: ResumeDiagnosis,
  followUpQuestions: FollowUpQuestion[] = [],
  savedCheckpoint: OptimizationCheckpoint = {}
): Promise<
  Pick<AnalysisResult, "optimizedItems" | "finalResume" | "finalResumeScore" | "interviewPrep">
> {
  const checkpoint: OptimizationCheckpoint = { ...savedCheckpoint };

  try {
    if (!checkpoint.optimizedItems) {
      const raw = await chatCompletionJSON<{
        optimizedItems: AnalysisResult["optimizedItems"];
      }>({
        operation: "regenerate:optimization",
        system: RESUME_AGENT_SYSTEM_PROMPT,
        user: buildOptimizeUserPrompt(input, style, followUpQuestions),
        temperature: 0.5,
        maxTokens: 12000,
      });
      checkpoint.optimizedItems = normalizeOptimizedItems(raw.optimizedItems);
    }

    if (!checkpoint.finalResume) {
      const finalResume = await chatCompletionJSON<FinalResumeResult>({
        operation: "regenerate:final-resume",
        system: RESUME_AGENT_SYSTEM_PROMPT,
        user: buildAnalyzeFinalResumePrompt(
          input,
          style,
          "",
          checkpoint.optimizedItems,
          followUpQuestions
        ),
        maxTokens: 16000,
      });
      checkpoint.finalResume = normalizeAnalysisResult(
        {
          finalResume: finalResume.finalResume,
        } as AnalysisResult,
        input
      ).finalResume;
    }
  } catch (error) {
    throw new OptimizationCheckpointError(error, checkpoint);
  }

  const scoreRequest =
    typeof checkpoint.finalResumeScore === "number"
      ? Promise.resolve<FinalResumeScoreResult | null>(null)
      : chatCompletionJSON<FinalResumeScoreResult>({
          operation: "regenerate:final-score",
          system: RESUME_AGENT_SYSTEM_PROMPT,
          user: buildFinalResumeScorePrompt(input, checkpoint.finalResume, diagnosis),
          temperature: 0.2,
          maxTokens: 4500,
        });
  const interviewRequest = checkpoint.interviewPrep
    ? Promise.resolve<InterviewResult | null>(null)
    : chatCompletionJSON<InterviewResult>({
        operation: "regenerate:interview",
        system: RESUME_AGENT_SYSTEM_PROMPT,
        user: buildAnalyzeInterviewPrompt(
          input,
          "",
          checkpoint.finalResume,
          checkpoint.optimizedItems,
          followUpQuestions
        ),
        maxTokens: 12000,
      });

  const [scoreResult, interviewResult] = await Promise.allSettled([
    scoreRequest,
    interviewRequest,
  ]);
  if (scoreResult.status === "fulfilled" && scoreResult.value) {
    checkpoint.finalResumeScore = scoreResult.value.overallScore;
  }
  if (interviewResult.status === "fulfilled" && interviewResult.value) {
    checkpoint.interviewPrep = interviewResult.value.interviewPrep;
  }

  const finalStageError =
    scoreResult.status === "rejected"
      ? scoreResult.reason
      : interviewResult.status === "rejected"
        ? interviewResult.reason
        : null;
  if (finalStageError) {
    throw new OptimizationCheckpointError(finalStageError, checkpoint);
  }

  return {
    optimizedItems: checkpoint.optimizedItems,
    finalResume: checkpoint.finalResume,
    finalResumeScore: Math.max(
      0,
      Math.min(100, Math.round(checkpoint.finalResumeScore!))
    ),
    interviewPrep: checkpoint.interviewPrep!,
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
    thinking: "disabled",
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
