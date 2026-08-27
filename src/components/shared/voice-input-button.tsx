"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

const OUTPUT_SAMPLE_RATE = 16_000;
const MAX_RECORDING_SECONDS = 55;

interface RecorderSession {
  context: AudioContext;
  stream: MediaStream;
  source: MediaStreamAudioSourceNode;
  processor: ScriptProcessorNode;
  silentGain: GainNode;
  chunks: Float32Array[];
  sampleRate: number;
  startedAt: number;
  maxTimer: ReturnType<typeof setTimeout>;
  elapsedTimer: ReturnType<typeof setInterval>;
}

interface VoiceInputButtonProps {
  disabled?: boolean;
  onActiveChange: (active: boolean) => void;
  onTranscript: (text: string) => void;
}

type MicrophonePermissionState = PermissionState | "unknown";

function mergeChunks(chunks: Float32Array[]) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const merged = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function resample(input: Float32Array, inputRate: number, outputRate: number) {
  if (inputRate === outputRate) return input;
  const outputLength = Math.max(1, Math.floor((input.length * outputRate) / inputRate));
  const output = new Float32Array(outputLength);
  const ratio = inputRate / outputRate;
  for (let index = 0; index < outputLength; index += 1) {
    const position = index * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, input.length - 1);
    const fraction = position - left;
    output[index] = input[left] * (1 - fraction) + input[right] * fraction;
  }
  return output;
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function encodeWav(samples: Float32Array) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, OUTPUT_SAMPLE_RATE, true);
  view.setUint32(28, OUTPUT_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

async function releaseSession(session: RecorderSession) {
  clearTimeout(session.maxTimer);
  clearInterval(session.elapsedTimer);
  session.processor.onaudioprocess = null;
  try {
    session.source.disconnect();
    session.processor.disconnect();
    session.silentGain.disconnect();
  } catch {
    // Some mobile browsers disconnect audio nodes automatically when a track ends.
  }
  session.stream.getTracks().forEach((track) => track.stop());
  await session.context.close().catch(() => undefined);
}

function formatElapsed(seconds: number) {
  return `00:${String(seconds).padStart(2, "0")}`;
}

export function VoiceInputButton({
  disabled = false,
  onActiveChange,
  onTranscript,
}: VoiceInputButtonProps) {
  const sessionRef = useRef<RecorderSession | null>(null);
  const stopRef = useRef<() => Promise<void>>(async () => undefined);
  const mountedRef = useRef(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [microphonePermission, setMicrophonePermission] =
    useState<MicrophonePermissionState>("unknown");
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [hasResult, setHasResult] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    let permissionStatus: PermissionStatus | null = null;
    let cancelled = false;
    const handlePermissionChange = () => {
      if (mountedRef.current && permissionStatus) {
        setMicrophonePermission(permissionStatus.state);
      }
    };

    if (navigator.permissions?.query) {
      void navigator.permissions
        .query({ name: "microphone" as PermissionName })
        .then((status) => {
          if (cancelled) return;
          permissionStatus = status;
          setMicrophonePermission(status.state);
          status.addEventListener("change", handlePermissionChange);
        })
        .catch(() => {
          // Safari and some embedded browsers do not expose microphone permission state.
        });
    }

    return () => {
      cancelled = true;
      mountedRef.current = false;
      permissionStatus?.removeEventListener("change", handlePermissionChange);
      const session = sessionRef.current;
      sessionRef.current = null;
      if (session) void releaseSession(session);
    };
  }, []);

  const stopAndTranscribe = async () => {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;
    setIsRecording(false);
    await releaseSession(session);

    const durationSeconds = (Date.now() - session.startedAt) / 1000;
    if (durationSeconds < 0.5 || session.chunks.length === 0) {
      setMessage("录音时间太短，请重新录制");
      onActiveChange(false);
      return;
    }

    const samples = resample(mergeChunks(session.chunks), session.sampleRate, OUTPUT_SAMPLE_RATE);
    const wav = encodeWav(samples);
    setIsTranscribing(true);
    setMessage("正在识别，请稍候…");
    setHasResult(false);
    try {
      const formData = new FormData();
      formData.append("audio", wav, "answer.wav");
      const response = await fetch("/api/speech/transcribe", {
        method: "POST",
        body: formData,
      });
      const body = (await response.json().catch(() => ({}))) as {
        text?: string;
        error?: string;
      };
      if (!response.ok || !body.text) {
        throw new Error(body.error || "语音识别失败，请稍后重试");
      }
      if (!mountedRef.current) return;
      onTranscript(body.text);
      setMessage("已转成文字，可继续编辑");
      setHasResult(true);
    } catch (error) {
      if (!mountedRef.current) return;
      setMessage(error instanceof Error ? error.message : "语音识别失败，请稍后重试");
    } finally {
      if (mountedRef.current) {
        setIsTranscribing(false);
        onActiveChange(false);
      }
    }
  };
  stopRef.current = stopAndTranscribe;

  const startRecording = async () => {
    setMessage(null);
    setHasResult(false);
    if (!window.isSecureContext && window.location.hostname !== "localhost") {
      setMessage("语音输入需要通过 HTTPS 使用");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("当前浏览器不支持麦克风录音");
      return;
    }

    let pendingStream: MediaStream | null = null;
    let pendingContext: AudioContext | null = null;
    try {
      setIsRequestingPermission(true);
      setMessage("正在请求麦克风权限，请在浏览器提示中选择“允许”…");
      onActiveChange(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      setMicrophonePermission("granted");
      pendingStream = stream;
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("当前浏览器不支持音频录制");
      }

      const context = new AudioContextClass();
      pendingContext = context;
      await context.resume();
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const silentGain = context.createGain();
      silentGain.gain.value = 0;
      const chunks: Float32Array[] = [];
      processor.onaudioprocess = (event) => {
        chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      };
      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(context.destination);

      const startedAt = Date.now();
      const session: RecorderSession = {
        context,
        stream,
        source,
        processor,
        silentGain,
        chunks,
        sampleRate: context.sampleRate,
        startedAt,
        elapsedTimer: setInterval(() => {
          if (mountedRef.current) {
            setElapsed(Math.min(MAX_RECORDING_SECONDS, Math.floor((Date.now() - startedAt) / 1000)));
          }
        }, 250),
        maxTimer: setTimeout(() => void stopRef.current(), MAX_RECORDING_SECONDS * 1000),
      };
      sessionRef.current = session;
      pendingStream = null;
      pendingContext = null;
      setElapsed(0);
      setIsRequestingPermission(false);
      setIsRecording(true);
      setMessage("麦克风权限已开启，正在录音…");
    } catch (error) {
      pendingStream?.getTracks().forEach((track) => track.stop());
      if (pendingContext) await pendingContext.close().catch(() => undefined);
      if (!mountedRef.current) return;
      setIsRequestingPermission(false);
      onActiveChange(false);
      const permissionDenied =
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "PermissionDeniedError");
      if (permissionDenied) setMicrophonePermission("denied");
      setMessage(
        permissionDenied
          ? "麦克风权限未开启。请点击地址栏旁的网站设置，允许使用麦克风后重试"
          : error instanceof Error
            ? error.message
            : "无法启动录音，请检查麦克风"
      );
    }
  };

  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant={isRecording ? "destructive" : "outline"}
        size="sm"
        disabled={disabled || isRequestingPermission || isTranscribing}
        onClick={isRecording ? () => void stopAndTranscribe() : () => void startRecording()}
        aria-pressed={isRecording}
        aria-busy={isRequestingPermission || isTranscribing}
      >
        {isRequestingPermission ? (
          <>
            <Loader2 className="animate-spin" />
            正在请求麦克风权限…
          </>
        ) : isTranscribing ? (
          <>
            <Loader2 className="animate-spin" />
            正在识别…
          </>
        ) : isRecording ? (
          <>
            <Square className="fill-current" />
            停止并识别 {formatElapsed(elapsed)}
          </>
        ) : (
          <>
            <Mic />
            {microphonePermission === "granted"
              ? "语音输入"
              : microphonePermission === "denied"
                ? "重新申请麦克风权限"
                : "允许麦克风并开始录音"}
          </>
        )}
      </Button>
      {message && (
        <p
          className={`flex items-center gap-1 text-xs ${hasResult ? "text-emerald-700" : "text-neutral-500"}`}
          role="status"
          aria-live="polite"
        >
          {hasResult && <CheckCircle2 className="h-3.5 w-3.5" />}
          {message}
        </p>
      )}
      {!message && !isRecording && !isRequestingPermission && !isTranscribing && (
        <p className="text-xs text-neutral-400">
          {microphonePermission === "granted"
            ? "最长55秒，录音将发送至腾讯云进行文字识别"
            : "首次使用会请求麦克风权限，同意后才会开始录音"}
        </p>
      )}
    </div>
  );
}
