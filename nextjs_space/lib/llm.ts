/**
 * LLM API Wrapper - Provider Agnostic
 * 
 * Kendi sunucunuza geçtiğinizde sadece bu dosyayı değiştirmeniz yeterli.
 * 
 * Alternatif sağlayıcılar:
 * - OpenAI: process.env.OPENAI_API_KEY ile
 * - Groq: process.env.GROQ_API_KEY ile (Llama modelleri, ücretsiz tier)
 * - Anthropic: process.env.ANTHROPIC_API_KEY ile
 * - Ollama: Kendi sunucunuzda (self-hosted)
 */

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

const DEFAULT_MODEL = 'gpt-4.1-mini';
const API_URL = 'https://apps.abacus.ai/v1/chat/completions';

/**
 * LLM API'ye istek gönderir
 * @param prompt - Kullanıcı prompt'u
 * @param systemPrompt - Sistem prompt'u (opsiyonel)
 * @param options - LLM ayarları (opsiyonel)
 */
export async function callLLM(
  prompt: string,
  systemPrompt?: string,
  options: LLMOptions = {}
): Promise<LLMResponse> {
  const { temperature = 0.3, maxTokens = 500, model = DEFAULT_MODEL } = options;

  const messages = [];
  
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  
  messages.push({ role: 'user', content: prompt });

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM API hatası: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: data.usage ? {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    } : undefined,
  };
}

/**
 * JSON string'i temizler ve parse eder
 */
function cleanAndParseJSON<T>(content: string): T {
  let cleaned = content.trim();
  
  // Markdown code block'larını temizle
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  
  cleaned = cleaned.trim();
  
  // İlk { veya [ karakterini bul
  const jsonStart = cleaned.search(/[\[{]/);
  if (jsonStart > 0) {
    cleaned = cleaned.slice(jsonStart);
  }
  
  // Son } veya ] karakterini bul
  const lastBrace = cleaned.lastIndexOf('}');
  const lastBracket = cleaned.lastIndexOf(']');
  const jsonEnd = Math.max(lastBrace, lastBracket);
  if (jsonEnd > 0 && jsonEnd < cleaned.length - 1) {
    cleaned = cleaned.slice(0, jsonEnd + 1);
  }
  
  return JSON.parse(cleaned) as T;
}

/**
 * JSON formatında yanıt alır
 */
export async function callLLMForJSON<T>(
  prompt: string,
  systemPrompt?: string,
  options: LLMOptions = {}
): Promise<T> {
  const response = await callLLM(prompt, systemPrompt, options);
  
  try {
    return cleanAndParseJSON<T>(response.content);
  } catch (e) {
    console.error('LLM JSON parse hatası. Ham içerik:', response.content);
    throw new Error('AI yanıtı işlenemedi. Lütfen tekrar deneyin.');
  }
}
