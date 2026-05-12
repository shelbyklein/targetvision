export type ProviderId = "openai" | "anthropic" | "gemini";

export const PROVIDER_IDS: ProviderId[] = ["openai", "anthropic", "gemini"];

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
};

export const PROVIDER_MODEL_OPTIONS: Record<ProviderId, string[]> = {
  openai: ["gpt-5.4", "gpt-5", "gpt-5-mini", "gpt-5-nano"],
  anthropic: ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5"],
  gemini: [
    "gemini-3.1-pro-preview",
    "gemini-3-flash-preview",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
  ],
};

export const DEFAULT_PROVIDER_MODELS: Record<ProviderId, string> = {
  openai: "gpt-5-mini",
  anthropic: "claude-sonnet-4-6",
  gemini: "gemini-2.5-flash",
};

/** @deprecated Use DEFAULT_PROVIDER_MODELS for the default and the configured value at runtime. */
export const PROVIDER_MODELS: Record<ProviderId, string> = DEFAULT_PROVIDER_MODELS;

export interface AnalysisRequest {
  imageDataUrl: string;
  contentType: string;
  systemPrompt: string;
  userText: string;
}

export interface RawAnalysisResult {
  description: string;
  suggestedCollectionIds: number[];
  suggestedTags: string[];
  suggestedCategoryIds: number[];
}

export interface AnalysisProvider {
  id: ProviderId;
  analyze(req: AnalysisRequest): Promise<RawAnalysisResult | null>;
}
