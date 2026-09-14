import { createHash, createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { APIRequestError, enforceRateLimit } from "@/lib/api/request-guard";

export const runtime = "nodejs";

const TENCENT_ASR_HOST = "asr.tencentcloudapi.com";
const TENCENT_ASR_ENDPOINT = `https://${TENCENT_ASR_HOST}`;
const TENCENT_ASR_SERVICE = "asr";
const TENCENT_ASR_ACTION = "SentenceRecognition";
const TENCENT_ASR_VERSION = "2019-06-14";
const MAX_AUDIO_BYTES = 2_150_000;

interface TencentASRResponse {
  Response?: {
    Result?: string;
    AudioDuration?: number;
    RequestId?: string;
    Error?: {
      Code?: string;
      Message?: string;
    };
  };
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function utcDate(timestamp: number) {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

function createAuthorization(payload: string, secretId: string, secretKey: string, timestamp: number) {
  const date = utcDate(timestamp);
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${TENCENT_ASR_HOST}\n`;
  const signedHeaders = "content-type;host";
  const canonicalRequest = [
    "POST",
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    sha256(payload),
  ].join("\n");
  const credentialScope = `${date}/${TENCENT_ASR_SERVICE}/tc3_request`;
  const stringToSign = [
    "TC3-HMAC-SHA256",
    timestamp,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");
  const secretDate = hmac(`TC3${secretKey}`, date);
  const secretService = hmac(secretDate, TENCENT_ASR_SERVICE);
  const secretSigning = hmac(secretService, "tc3_request");
  const signature = createHmac("sha256", secretSigning)
    .update(stringToSign, "utf8")
    .digest("hex");

  return `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

function isWav(bytes: Uint8Array) {
  if (bytes.length < 12) return false;
  const signature = Buffer.from(bytes.subarray(0, 12)).toString("ascii");
  return signature.startsWith("RIFF") && signature.slice(8, 12) === "WAVE";
}

function errorResponse(error: APIRequestError) {
  const headers = error.retryAfterSeconds
    ? { "Retry-After": String(error.retryAfterSeconds) }
    : undefined;
  return NextResponse.json({ error: error.message }, { status: error.status, headers });
}

export async function POST(request: Request) {
  try {
    enforceRateLimit(request);

    const secretId = process.env.TENCENT_CLOUD_SECRET_ID?.trim();
    const secretKey = process.env.TENCENT_CLOUD_SECRET_KEY?.trim();
    if (!secretId || !secretKey) {
      return NextResponse.json(
        { error: "语音识别服务尚未配置，请联系管理员" },
        { status: 503 }
      );
    }

    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_AUDIO_BYTES + 100_000) {
      return NextResponse.json({ error: "录音过长，请控制在55秒以内" }, { status: 413 });
    }

    const formData = await request.formData();
    const audio = formData.get("audio");
    if (!(audio instanceof File)) {
      return NextResponse.json({ error: "没有收到录音文件" }, { status: 400 });
    }
    if (audio.size === 0) {
      return NextResponse.json({ error: "录音内容为空，请重新录制" }, { status: 400 });
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "录音过长，请控制在55秒以内" }, { status: 413 });
    }

    const bytes = new Uint8Array(await audio.arrayBuffer());
    if (!isWav(bytes)) {
      return NextResponse.json({ error: "录音格式不正确，请重新录制" }, { status: 415 });
    }

    const payload = JSON.stringify({
      EngSerViceType: process.env.TENCENT_ASR_ENGINE_TYPE?.trim() || "16k_zh",
      SourceType: 1,
      VoiceFormat: "wav",
      Data: Buffer.from(bytes).toString("base64"),
      DataLen: bytes.byteLength,
      WordInfo: 0,
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const authorization = createAuthorization(payload, secretId, secretKey, timestamp);
    const region = process.env.TENCENT_ASR_REGION?.trim() || "ap-shanghai";

    const response = await fetch(TENCENT_ASR_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json; charset=utf-8",
        Host: TENCENT_ASR_HOST,
        "X-TC-Action": TENCENT_ASR_ACTION,
        "X-TC-Version": TENCENT_ASR_VERSION,
        "X-TC-Timestamp": String(timestamp),
        "X-TC-Region": region,
      },
      body: payload,
      signal: AbortSignal.timeout(30_000),
    });

    const result = (await response.json()) as TencentASRResponse;
    const apiError = result.Response?.Error;
    if (!response.ok || apiError) {
      console.error("Tencent ASR request failed", {
        status: response.status,
        code: apiError?.Code,
        requestId: result.Response?.RequestId,
      });
      const isConfigurationError =
        apiError?.Code?.startsWith("AuthFailure") ||
        apiError?.Code?.startsWith("UnauthorizedOperation");
      return NextResponse.json(
        {
          error: isConfigurationError
            ? "语音识别服务配置异常，请联系管理员"
            : "语音识别失败，请稍后重试",
        },
        { status: isConfigurationError ? 503 : 502 }
      );
    }

    const text = result.Response?.Result?.trim();
    if (!text) {
      return NextResponse.json(
        { error: "没有识别到清晰语音，请靠近麦克风后重试" },
        { status: 422 }
      );
    }

    return NextResponse.json({
      text,
      durationMs: result.Response?.AudioDuration ?? null,
    });
  } catch (error) {
    if (error instanceof APIRequestError) return errorResponse(error);
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json({ error: "语音识别超时，请稍后重试" }, { status: 504 });
    }
    console.error("Speech transcription failed", error);
    return NextResponse.json({ error: "语音识别失败，请稍后重试" }, { status: 500 });
  }
}
