import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

interface AIResponseLogEntry {
  operation: string;
  provider: string;
  model: string;
  httpStatus: number;
  status: "success" | "http-error" | "invalid-response";
  finishReason?: string;
  usage?: unknown;
  rawResponse: string;
}

const globalLogState = globalThis as typeof globalThis & {
  __resumeExpertAILogRunId?: string;
  __resumeExpertAILogQueue?: Promise<void>;
};

const runId =
  globalLogState.__resumeExpertAILogRunId ??
  `${new Date().toISOString().replace(/[:.]/g, "-")}-${process.pid}`;

globalLogState.__resumeExpertAILogRunId = runId;

const logDirectory = path.join(process.cwd(), ".ai-logs");
const logFile = path.join(logDirectory, `run-${runId}.jsonl`);

export async function logAIResponse(entry: AIResponseLogEntry): Promise<void> {
  const writeLog = async () => {
    await mkdir(logDirectory, { recursive: true });
    await appendFile(
      logFile,
      `${JSON.stringify({ timestamp: new Date().toISOString(), runId, ...entry })}\n`,
      "utf8"
    );
  };

  const queuedWrite = (globalLogState.__resumeExpertAILogQueue ?? Promise.resolve()).then(writeLog);
  globalLogState.__resumeExpertAILogQueue = queuedWrite.catch(() => undefined);

  try {
    await queuedWrite;
  } catch (error) {
    console.warn("[ai-response-log] 本地日志写入失败", error);
  }
}
