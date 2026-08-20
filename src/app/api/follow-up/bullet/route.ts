import { NextResponse } from "next/server";
import { LLMError } from "@/lib/ai/client";
import type { FollowUpBulletRequestBody } from "@/lib/ai/types";
import { APIRequestError, parseProtectedJSON } from "@/lib/api/request-guard";
import { generateFollowUpBulletServer } from "@/services/ai/resumeAgent.server";

export async function POST(request: Request) {
  try {
    const body = await parseProtectedJSON<FollowUpBulletRequestBody>(request);
    const { input, question, purpose, userAnswer, exampleMode = false } = body;

    if (!userAnswer?.trim()) {
      return NextResponse.json({ error: "请先填写回答" }, { status: 400 });
    }

    const { bullet, mode } = await generateFollowUpBulletServer(
      input,
      question,
      purpose,
      userAnswer,
      exampleMode
    );
    return NextResponse.json({ bullet, mode });
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
    const message = error instanceof LLMError ? error.message : "Bullet 生成失败，请稍后重试";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
