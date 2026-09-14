import { NextResponse } from "next/server";
import { LLMError } from "@/lib/ai/client";
import { AnalysisCheckpointError } from "@/lib/ai/errors";
import type { AnalyzeStageRequestBody } from "@/lib/ai/types";
import { APIRequestError, parseProtectedJSON } from "@/lib/api/request-guard";
import { analyzeResumeStageServer } from "@/services/ai/resumeAgent.server";

const ANALYSIS_STAGES = [
  "jd",
  "diagnosis-match",
  "experience-inventory",
  "follow-ups",
] as const;

export async function POST(request: Request) {
  try {
    const body = await parseProtectedJSON<AnalyzeStageRequestBody>(request);
    const { input, stage, exampleMode = false, checkpoint } = body;

    if (!input?.targetRole?.trim() || !input?.jobDescription?.trim() || !input?.originalResume?.trim()) {
      return NextResponse.json({ error: "请填写目标岗位、JD 和原始简历" }, { status: 400 });
    }
    if (!stage || !ANALYSIS_STAGES.includes(stage)) {
      return NextResponse.json({ error: "缺少分析阶段" }, { status: 400 });
    }

    const result = await analyzeResumeStageServer(input, stage, exampleMode, checkpoint);
    return NextResponse.json({ stage, ...result });
  } catch (error) {
    if (error instanceof APIRequestError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: error.status,
          headers: error.retryAfterSeconds
            ? { "Retry-After": String(error.retryAfterSeconds) }
            : undefined,
        }
      );
    }
    const message =
      error instanceof LLMError
        ? error.message
        : error instanceof Error
          ? error.message
          : "分析失败，请稍后重试";
    console.error("[analyze:stage]", error);
    return NextResponse.json(
      {
        error: message,
        ...(error instanceof AnalysisCheckpointError
          ? { checkpoint: error.checkpoint }
          : {}),
      },
      { status: 500 }
    );
  }
}
