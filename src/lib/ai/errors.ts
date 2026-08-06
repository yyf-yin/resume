import type { AnalysisCheckpoint, OptimizationCheckpoint } from "@/lib/ai/types";

export class LLMError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "LLMError";
  }
}

export class AnalysisCheckpointError extends LLMError {
  constructor(
    cause: unknown,
    readonly checkpoint: AnalysisCheckpoint
  ) {
    super(
      cause instanceof LLMError
        ? cause.message
        : cause instanceof Error
          ? cause.message
          : "大模型请求异常",
      cause instanceof LLMError ? cause.status : undefined
    );
    this.name = "AnalysisCheckpointError";
  }
}

export class OptimizationCheckpointError extends LLMError {
  constructor(
    cause: unknown,
    readonly checkpoint: OptimizationCheckpoint
  ) {
    super(
      cause instanceof LLMError
        ? cause.message
        : cause instanceof Error
          ? cause.message
          : "大模型请求异常",
      cause instanceof LLMError ? cause.status : undefined
    );
    this.name = "OptimizationCheckpointError";
  }
}
