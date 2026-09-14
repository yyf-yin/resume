import { NextResponse } from "next/server";
import { LLMError } from "@/lib/ai/client";
import type { PerfectionRequestBody } from "@/lib/ai/types";
import { APIRequestError, parseProtectedJSON } from "@/lib/api/request-guard";
import { generatePerfectionPlanServer } from "@/services/ai/resumeAgent.server";

export async function POST(request: Request) {
  try {
    const body = await parseProtectedJSON<PerfectionRequestBody>(request);
    const { input, diagnosis, matchItems, followUpQuestions = [], exampleMode = false } = body;

    if (!input?.targetRole?.trim() || !diagnosis || !Array.isArray(matchItems)) {
      return NextResponse.json({ error: "缺少生成补强计划所需的分析数据" }, { status: 400 });
    }

    const { plan, mode } = await generatePerfectionPlanServer(
      input,
      diagnosis,
      matchItems,
      followUpQuestions,
      exampleMode
    );
    return NextResponse.json({ plan, mode });
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
          : "补强计划生成失败，请稍后重试";
    console.error("[perfection]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
