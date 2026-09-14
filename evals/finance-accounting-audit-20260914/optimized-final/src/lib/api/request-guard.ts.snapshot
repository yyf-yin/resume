// A complete staged analysis can legitimately use 8 requests, plus optional
// follow-up bullet generation and retries. Keep enough headroom for one workflow.
const DEFAULT_MAX_REQUESTS = 40;
const DEFAULT_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const globalRateLimitState = globalThis as typeof globalThis & {
  __resumeAssistantRateLimits?: Map<string, RateLimitEntry>;
};

const rateLimits =
  globalRateLimitState.__resumeAssistantRateLimits ?? new Map<string, RateLimitEntry>();
globalRateLimitState.__resumeAssistantRateLimits = rateLimits;

export class APIRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "APIRequestError";
  }
}

export async function parseProtectedJSON<T>(request: Request): Promise<T> {
  enforceRateLimit(request);

  const maxBodyBytes = readPositiveInteger("API_MAX_BODY_BYTES", DEFAULT_MAX_BODY_BYTES);
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > maxBodyBytes) {
    throw new APIRequestError("请求内容过大", 413);
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > maxBodyBytes) {
    throw new APIRequestError("请求内容过大", 413);
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    throw new APIRequestError("请求格式不正确", 400);
  }
}

export function enforceRateLimit(request: Request) {
  const now = Date.now();
  const windowMs = readPositiveInteger("API_RATE_LIMIT_WINDOW_MS", DEFAULT_WINDOW_MS);
  const maxRequests = readPositiveInteger("API_RATE_LIMIT_MAX", DEFAULT_MAX_REQUESTS);
  const key = getClientIP(request);
  const current = rateLimits.get(key);

  if (!current || current.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    pruneExpiredEntries(now);
    return;
  }

  if (current.count >= maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    throw new APIRequestError("请求过于频繁，请稍后再试", 429, retryAfterSeconds);
  }

  current.count += 1;
}

function getClientIP(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function pruneExpiredEntries(now: number) {
  if (rateLimits.size < 1000) return;
  for (const [key, value] of rateLimits) {
    if (value.resetAt <= now) rateLimits.delete(key);
  }
}

function readPositiveInteger(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
