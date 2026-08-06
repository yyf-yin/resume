import { NextResponse } from "next/server";
import { LLMError } from "@/lib/ai/client";
import { OptimizationCheckpointError } from "@/lib/ai/errors";
import type { OptimizeRequestBody } from "@/lib/ai/types";
import { regenerateOptimizedItemsServer } from "@/services/ai/resumeAgent.server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as OptimizeRequestBody;
    const {
      input,
      style,
      followUpQuestions = [],
      diagnosis,
      exampleMode = false,
      checkpoint,
    } = body;

    if (!input?.originalResume?.trim() || !style) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    if (!diagnosis) {
      return NextResponse.json({ error: "缺少原始简历诊断信息" }, { status: 400 });
    }

    const { optimizedItems, finalResume, finalResumeScore, interviewPrep, mode } =
      await regenerateOptimizedItemsServer(
        input,
        style,
        diagnosis,
        followUpQuestions,
        exampleMode,
        checkpoint
      );
    return NextResponse.json({
      optimizedItems,
      finalResume,
      finalResumeScore,
      interviewPrep,
      mode,
    });
  } catch (error) {
    const message = error instanceof LLMError ? error.message : "优化生成失败，请稍后重试";
    return NextResponse.json(
      {
        error: message,
        ...(error instanceof OptimizationCheckpointError
          ? { checkpoint: error.checkpoint }
          : {}),
      },
      { status: 500 }
    );
  }
}
