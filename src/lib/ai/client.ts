import { getAIConfig } from "@/lib/ai/config";
import { LLMError } from "@/lib/ai/errors";
import { parseJSONFromMessage } from "@/lib/ai/parse-json";
import { logAIResponse } from "@/lib/ai/response-logger";

export { LLMError } from "@/lib/ai/errors";

interface ChatCompletionOptions {
  operation: string;
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  thinking?: "enabled" | "disabled";
}

interface ChatMessage {
  content?: string | null;
  reasoning_content?: string | null;
}

export async function chatCompletionJSON<T>(options: ChatCompletionOptions): Promise<T> {
  try {
    return await requestChatCompletionJSON<T>(options);
  } catch (error) {
    if (error instanceof LLMError) throw error;
    throw new LLMError(error instanceof Error ? error.message : "大模型请求异常");
  }
}

async function requestChatCompletionJSON<T>(options: ChatCompletionOptions): Promise<T> {
  const config = getAIConfig();
  if (!config.apiKey) throw new LLMError("未配置 LLM_API_KEY");

  const data = await callChatCompletions(config, options);
  const choice = data.choices?.[0];
  const contents = extractMessageContents(choice?.message);

  try {
    return parseJSONFromMessage<T>(contents);
  } catch (parseError) {
    const raw = contents.join("\n\n");
    if (!raw) throw new LLMError("大模型返回内容为空");

    const fixed = await callChatCompletions(config, {
      ...options,
      operation: `${options.operation}:json-repair`,
      temperature: 0,
      system: "你是 JSON 修复器。将输入修复为合法 JSON，只输出 JSON，不要任何解释。",
      user: `修复以下 JSON：\n${raw.slice(0, 14000)}`,
    });

    const fixedContents = extractMessageContents(fixed.choices?.[0]?.message);
    try {
      return parseJSONFromMessage<T>(fixedContents);
    } catch {
      if (choice?.finish_reason === "length") {
        throw new LLMError("大模型输出被截断，请缩短 JD/简历内容后重试");
      }
      throw parseError instanceof LLMError ? parseError : new LLMError("大模型返回的 JSON 无法解析");
    }
  }
}

async function callChatCompletions(
  config: ReturnType<typeof getAIConfig>,
  options: ChatCompletionOptions
) {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 8192,
      ...(options.thinking ? { thinking: { type: options.thinking } } : {}),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: options.system },
        { role: "user", content: options.user },
      ],
    }),
  });

  const rawResponse = await response.text();

  if (!response.ok) {
    await logAIResponse({
      operation: options.operation,
      provider: config.provider,
      model: config.model,
      httpStatus: response.status,
      status: "http-error",
      rawResponse,
    });
    throw new LLMError(
      rawResponse
        ? `大模型请求失败 (${response.status}): ${rawResponse.slice(0, 300)}`
        : `大模型请求失败 (${response.status})`,
      response.status
    );
  }

  let data: {
    choices?: Array<{
      finish_reason?: string;
      message?: ChatMessage;
    }>;
    usage?: unknown;
  };

  try {
    data = JSON.parse(rawResponse) as typeof data;
  } catch {
    await logAIResponse({
      operation: options.operation,
      provider: config.provider,
      model: config.model,
      httpStatus: response.status,
      status: "invalid-response",
      rawResponse,
    });
    throw new LLMError("大模型接口返回了无法解析的响应");
  }

  await logAIResponse({
    operation: options.operation,
    provider: config.provider,
    model: config.model,
    httpStatus: response.status,
    status: "success",
    finishReason: data.choices?.[0]?.finish_reason,
    usage: data.usage,
    rawResponse,
  });

  return data;
}

function extractMessageContents(message?: ChatMessage): string[] {
  const results: string[] = [];
  const content = message?.content?.trim();
  if (content) results.push(content);

  const reasoning = message?.reasoning_content?.trim();
  if (reasoning) {
    const jsonMatch = reasoning.match(/\{[\s\S]*\}/);
    if (jsonMatch?.[0]) results.push(jsonMatch[0]);
  }

  return results;
}
