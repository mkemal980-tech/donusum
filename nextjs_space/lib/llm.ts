export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const DEFAULT_BASE_URL = "https://api.openai.com/v1";

export function isLLMConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function getChatCompletionsUrl(): string {
  const baseUrl = (process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  return `${baseUrl}/chat/completions`;
}

export async function callLLM(
  prompt: string,
  systemPrompt?: string,
  options: LLMOptions = {}
): Promise<LLMResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("AI provider is not configured");
  }

  const { temperature = 0.3, maxTokens = 500, model = DEFAULT_MODEL } = options;
  const messages = [];

  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }

  messages.push({ role: "user", content: prompt });

  const response = await fetch(getChatCompletionsUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI provider error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  return {
    content: data.choices?.[0]?.message?.content || "",
    usage: data.usage ? {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens
    } : undefined
  };
}

function cleanAndParseJSON<T>(content: string): T {
  let cleaned = content.trim();

  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }

  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }

  cleaned = cleaned.trim();

  const jsonStart = cleaned.search(/[\[{]/);
  if (jsonStart > 0) {
    cleaned = cleaned.slice(jsonStart);
  }

  const lastBrace = cleaned.lastIndexOf("}");
  const lastBracket = cleaned.lastIndexOf("]");
  const jsonEnd = Math.max(lastBrace, lastBracket);
  if (jsonEnd > 0 && jsonEnd < cleaned.length - 1) {
    cleaned = cleaned.slice(0, jsonEnd + 1);
  }

  return JSON.parse(cleaned) as T;
}

export async function callLLMForJSON<T>(
  prompt: string,
  systemPrompt?: string,
  options: LLMOptions = {}
): Promise<T> {
  const response = await callLLM(prompt, systemPrompt, options);

  try {
    return cleanAndParseJSON<T>(response.content);
  } catch {
    console.error("AI JSON parse error. Raw content:", response.content);
    throw new Error("AI yanıtı işlenemedi. Lütfen tekrar deneyin.");
  }
}
