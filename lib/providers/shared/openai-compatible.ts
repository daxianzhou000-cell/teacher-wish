import { getJsonSchemaByMode, getRequiredKeysByMode } from "@/lib/providers/openai/schema";
import type { ProviderContext } from "@/lib/providers/types";
import type { GenerateRequest } from "@/lib/types/lesson-package";
import { containsReplacementChar } from "@/lib/utils/render-math-text";

type OpenAIResponse = {
  error?: {
    message?: string;
  };
  output_text?: string;
  output_parsed?: unknown;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      refusal?: string;
    }>;
  }>;
};

type ChatCompletionsResponse = {
  error?: {
    message?: string;
  };
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
      refusal?: string;
    };
  }>;
};

type JsonRequestMode = "json_schema" | "json_object" | "prompt_only";

function isCompatibilityRetryableError(message: string): boolean {
  return /not_found|unsupported|unknown|route|路径|endpoint|not implemented|convert_request_failed|invalid argument|invalid_request|unsupported_parameter|response_format|json_schema|schema|format/i.test(
    message,
  );
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl
    .trim()
    .replace(/\/+(responses|models)$/i, "")
    .replace(/\/+chat\/completions$/i, "")
    .replace(/\/+$/, "");
}

function buildApiBaseCandidates(baseUrl: string): string[] {
  const normalized = normalizeBaseUrl(baseUrl);

  if (!normalized) {
    return [];
  }

  const candidates = [normalized];

  if (!/\/v\d+$/.test(normalized)) {
    candidates.push(`${normalized}/v1`);
  }

  return Array.from(new Set(candidates));
}

function extractRefusal(response: OpenAIResponse): string | null {
  for (const item of response.output ?? []) {
    if (item.type !== "message" || !Array.isArray(item.content)) {
      continue;
    }

    const refusal = item.content.find(
      (content) => content.type === "refusal" && typeof content.refusal === "string",
    )?.refusal;

    if (refusal?.trim()) {
      return refusal.trim();
    }
  }

  return null;
}

function extractOutputText(response: OpenAIResponse): string | null {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  for (const item of response.output ?? []) {
    if (item.type !== "message" || !Array.isArray(item.content)) {
      continue;
    }

    const text = item.content
      .filter((content) => content.type === "output_text" && typeof content.text === "string")
      .map((content) => content.text)
      .join("")
      .trim();

    if (text) {
      return text;
    }
  }

  return null;
}

function stripReasoningBlocks(value: string): string {
  return value
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```json\s*([\s\S]*?)```/gi, "$1")
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, ""))
    .trim();
}

function extractJsonCandidate(value: string): string {
  const normalized = stripReasoningBlocks(value);

  if (!normalized) {
    return value.trim();
  }

  const firstBrace = normalized.indexOf("{");
  const lastBrace = normalized.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return normalized.slice(firstBrace, lastBrace + 1).trim();
  }

  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasRequiredShape(value: unknown, requiredKeys: readonly string[]): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return requiredKeys.every((key) => key in value);
}

function tryParseJsonCandidate(value: string): unknown {
  try {
    return JSON.parse(extractJsonCandidate(value));
  } catch {
    return null;
  }
}

function buildStrictOutputInstruction(input: GenerateRequest) {
  const mode =
    input.mode === "stage_test"
      ? "stage_test"
      : input.mode === "follow_up"
          ? "follow_up"
          : "single";
  const requiredKeys = getRequiredKeysByMode(mode);

  if (input.mode === "stage_test") {
    return [
      "你上一轮没有按 stage_test 结构返回内容，现在必须纠正。",
      "你必须只返回一个 JSON 对象，且只能包含以下顶层字段：",
      requiredKeys.join(", "),
      "字段结构必须为：",
      "- title: string",
      "- topicsCovered: string[]，必须覆盖 selectedTopics，长度 3-6",
      "- testDirections: string[]",
      "- questions: 12-15 道，[{ type, prompt }]，题目区不要携带答案或解析",
      "- answerAnalysis: 12-15 条，[{ questionIndex, answer, analysis }]",
      "不要输出 lesson_package 的 8 个模块，不要输出 Markdown 标题、代码块或额外说明，只返回 JSON。",
    ].join("\n");
  }

  return [
    "你上一轮没有按 lesson_package 结构返回内容，现在必须纠正。",
    "你必须只返回一个 JSON 对象，且只能包含以下顶层字段：",
    requiredKeys.join(", "),
    "不要输出“主题”“定义”“标准形式”“核心概念”“解题步骤”等其他顶层字段。",
    "字段结构必须为：",
    "- overview: string，且必须是完整知识讲义，不是导语",
    "- keyPoints: string[]",
    "- difficulties: string[]",
    "- examples: [{ title, question, thinkingBreakpoint, process, perfectAnswer }]，每道例题必须完整讲解，不能只给题目",
    "- classExercises: 4-6 道，[{ question, answer }]",
    "- homework: 6-10 道，[{ question, answer }]",
    "- answerAnalysis: string[]，只解析课堂练习、课后练习和小测收尾，不得重讲例题示范",
    "- improvementTips: 3-6 条具体建议，不能空泛",
    "- quickQuiz: 2-3 道，[{ question, answer }]",
    "禁止返回 Markdown 标题、解释文字、代码块包裹或额外说明，只返回 JSON。",
    "如果仍不确定，请严格按这 9 个字段的名字和类型返回，不要自创结构。",
  ].join("\n");
}

function logEncodingWarning(layer: string, value: string) {
  if (process.env.NODE_ENV === "production" || !containsReplacementChar(value)) {
    return;
  }

  console.warn("[model debug] 检测到疑似乱码字符", {
    layer,
    length: value.length,
    preview: value.slice(0, 200),
  });
}

function extractChatCompletionsText(response: ChatCompletionsResponse): string | null {
  const firstChoice = response.choices?.[0]?.message;

  if (!firstChoice) {
    return null;
  }

  if (typeof firstChoice.refusal === "string" && firstChoice.refusal.trim()) {
    throw new Error(`模型拒绝生成内容：${firstChoice.refusal.trim()}`);
  }

  if (typeof firstChoice.content === "string" && firstChoice.content.trim()) {
    const text = extractJsonCandidate(firstChoice.content);
    logEncodingWarning("chat_completions.outputText", text);
    return text;
  }

  if (Array.isArray(firstChoice.content)) {
    const text = firstChoice.content
      .map((item) => (typeof item.text === "string" ? item.text : ""))
      .join("")
      .trim();

    if (text) {
      const normalized = extractJsonCandidate(text);
      logEncodingWarning("chat_completions.outputText", normalized);
      return normalized;
    }
  }

  return null;
}

async function requestViaResponses(
  url: string,
  apiKey: string,
  model: string,
  context: ProviderContext,
  input: GenerateRequest,
): Promise<{ ok: true; value: unknown } | { ok: false; retryable: boolean; message: string }> {
  const mode =
    input.mode === "stage_test"
      ? "stage_test"
      : input.mode === "follow_up"
          ? "follow_up"
          : "single";
  const jsonSchema = getJsonSchemaByMode(mode);
  const requiredKeys = getRequiredKeysByMode(mode);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions: context.prompt.system,
      input: `${context.prompt.user}\n\n请以 JSON 输出，字段必须与给定 schema 一致。`,
      text: {
        format: {
          type: "json_schema",
          ...jsonSchema,
        },
      },
    }),
  });

  const rawText = await response.text();
  logEncodingWarning("responses.rawText", rawText);

  if (/<!doctype html>|<html/i.test(rawText)) {
    return {
      ok: false,
      retryable: true,
      message: "当前地址返回的是平台网页，不是 API 结果。",
    };
  }

  let data: OpenAIResponse;

  try {
    data = JSON.parse(rawText) as OpenAIResponse;
  } catch {
    return {
      ok: false,
      retryable: true,
      message: "返回内容无法解析为 JSON。",
    };
  }

  if (!response.ok) {
    const message = data.error?.message || "请求失败。";
    return {
      ok: false,
      retryable: isCompatibilityRetryableError(message),
      message,
    };
  }

  const refusal = extractRefusal(data);

  if (refusal) {
    throw new Error(`模型拒绝生成内容：${refusal}`);
  }

  if (data.output_parsed !== undefined) {
    if (hasRequiredShape(data.output_parsed, requiredKeys)) {
      return { ok: true, value: data.output_parsed };
    }

    return {
      ok: false,
      retryable: true,
      message: `responses 返回内容未按 ${mode === "stage_test" ? "stage_test" : "lesson_package"} 结构组织。`,
    };
  }

  const text = extractOutputText(data);

  if (!text) {
    return {
      ok: false,
      retryable: true,
      message: "返回空内容。",
    };
  }

  logEncodingWarning("responses.outputText", text);

  const parsed = tryParseJsonCandidate(text);

  if (hasRequiredShape(parsed, requiredKeys)) {
    return { ok: true, value: parsed };
  }

  return {
    ok: false,
    retryable: true,
    message: `responses 返回内容未按 ${mode === "stage_test" ? "stage_test" : "lesson_package"} 结构组织。`,
  };
}

async function requestViaChatCompletions(
  url: string,
  apiKey: string,
  model: string,
  context: ProviderContext,
  input: GenerateRequest,
): Promise<{ ok: true; value: unknown } | { ok: false; message: string }> {
  const mode =
    input.mode === "stage_test"
      ? "stage_test"
      : input.mode === "follow_up"
          ? "follow_up"
          : "single";
  const jsonSchema = getJsonSchemaByMode(mode);
  const requiredKeys = getRequiredKeysByMode(mode);

  async function sendRequest(mode: JsonRequestMode, userContent: string) {
    const payload: Record<string, unknown> = {
      model,
      messages: [
        { role: "system", content: context.prompt.system },
        { role: "user", content: userContent },
      ],
    };

    if (mode !== "prompt_only") {
      payload.response_format =
        mode === "json_schema"
          ? {
              type: "json_schema",
              json_schema: jsonSchema,
            }
          : {
              type: "json_object",
            };
    }

    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  }

  async function resolveRequest(
    mode: JsonRequestMode,
    userContent: string,
  ): Promise<
    | { ok: true; value: unknown }
    | { ok: false; message: string; retryableShape?: boolean; retryableCompatibility?: boolean }
  > {
    const response = await sendRequest(mode, userContent);
    const rawText = await response.text();
    logEncodingWarning("chat_completions.rawText", rawText);

    if (/<!doctype html>|<html/i.test(rawText)) {
      return {
        ok: false,
        message: "当前地址返回的是平台网页，不是 API 结果。",
      };
    }

    let data: ChatCompletionsResponse;

    try {
      data = JSON.parse(rawText) as ChatCompletionsResponse;
    } catch {
      return {
        ok: false,
        message: "返回内容无法解析为 JSON。",
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        message: data.error?.message || "请求失败。",
        retryableCompatibility:
          mode !== "prompt_only"
            ? isCompatibilityRetryableError(data.error?.message || "请求失败。")
            : false,
      };
    }

    const text = extractChatCompletionsText(data);

    if (!text) {
      return {
        ok: false,
        message: "返回空内容。",
      };
    }

    const parsed = tryParseJsonCandidate(text);

    if (hasRequiredShape(parsed, requiredKeys)) {
      if (process.env.NODE_ENV !== "production") {
        console.info("[model debug] chat_completions 已返回目标结构", {
          mode,
        });
      }

      return { ok: true, value: parsed };
    }

    if (process.env.NODE_ENV !== "production") {
      console.warn("[model debug] chat_completions 未按目标结构返回，准备重试", {
        mode,
        preview: extractJsonCandidate(text).slice(0, 300),
      });
    }

    return {
      ok: false,
      message: `模型未按 ${input.mode === "stage_test" ? "stage_test" : "lesson_package"} 结构返回内容。`,
      retryableShape: true,
    };
  }

  const primaryResult = await resolveRequest(
    "json_schema",
    `${context.prompt.user}\n\n请以 JSON 输出，字段必须与给定 schema 一致。`,
  );

  if (primaryResult.ok) {
    return primaryResult;
  }

  if (!primaryResult.retryableShape && !primaryResult.retryableCompatibility) {
    return {
      ok: false,
      message: primaryResult.message,
    };
  }

  const strictResult = await resolveRequest(
    "json_object",
    `${context.prompt.user}\n\n${buildStrictOutputInstruction(input)}`,
  );

  if (strictResult.ok) {
    return strictResult;
  }

  if (!strictResult.retryableShape && !strictResult.retryableCompatibility) {
    return {
      ok: false,
      message: strictResult.message,
    };
  }

  const promptOnlyResult = await resolveRequest(
    "prompt_only",
    `${context.prompt.user}\n\n${buildStrictOutputInstruction(input)}`,
  );

  if (promptOnlyResult.ok) {
    return promptOnlyResult;
  }

  return {
    ok: false,
    message: promptOnlyResult.message,
  };
}

export async function requestOpenAICompatibleLessonPackage(
  input: GenerateRequest,
  context: ProviderContext,
  fallback: {
    apiKey?: string;
    baseUrl: string;
    model: string;
    providerLabel: string;
  },
): Promise<unknown> {
  const apiKey = context.config.apiKey || fallback.apiKey || "";
  const model = context.config.model || fallback.model;
  const baseCandidates = buildApiBaseCandidates(context.config.baseUrl || fallback.baseUrl);

  if (!baseCandidates.length) {
    throw new Error(`缺少 ${fallback.providerLabel} 的 Base URL。`);
  }

  if (context.config.provider !== "mock" && !apiKey) {
    throw new Error(`缺少 ${fallback.providerLabel} 的 API Key。`);
  }

  let lastError = `${fallback.providerLabel} 请求失败。`;

  for (const base of baseCandidates) {
    const responsesResult = await requestViaResponses(
      `${base}/responses`,
      apiKey,
      model,
      context,
      input,
    );

    if (responsesResult.ok) {
      return responsesResult.value;
    }

    lastError = responsesResult.message;

    if (!responsesResult.retryable) {
      throw new Error(lastError);
    }

    const chatResult = await requestViaChatCompletions(
      `${base}/chat/completions`,
      apiKey,
      model,
      context,
      input,
    );

    if (chatResult.ok) {
      return chatResult.value;
    }

    lastError = chatResult.message;
  }

  throw new Error(`${fallback.providerLabel} 调用失败：${lastError}`);
}
