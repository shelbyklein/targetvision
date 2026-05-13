export type ProviderId = "openai" | "anthropic" | "gemini";

export const PROVIDER_IDS: ProviderId[] = ["openai", "anthropic", "gemini"];

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
};

export interface ModelOption {
  id: string;
  label: string;
}

export const PROVIDER_MODEL_DETAILS: Record<ProviderId, ModelOption[]> = {
  openai: [
    { id: "gpt-5.4", label: "Best quality — slowest, most expensive" },
    { id: "gpt-5", label: "High quality — balanced cost" },
    { id: "gpt-5-mini", label: "Balanced — recommended" },
    { id: "gpt-5-nano", label: "Fastest, cheapest" },
  ],
  anthropic: [
    { id: "claude-opus-4-7", label: "Best quality — slowest, most expensive" },
    { id: "claude-sonnet-4-6", label: "Balanced — recommended" },
    { id: "claude-haiku-4-5", label: "Fastest, cheapest" },
  ],
  gemini: [
    { id: "gemini-3.1-pro-preview", label: "Best quality (preview) — slower" },
    { id: "gemini-3-flash-preview", label: "Fast preview — newest" },
    { id: "gemini-2.5-pro", label: "High quality — stable" },
    { id: "gemini-2.5-flash", label: "Fastest, cheapest — recommended" },
  ],
};

export const PROVIDER_MODEL_OPTIONS: Record<ProviderId, string[]> = {
  openai: PROVIDER_MODEL_DETAILS.openai.map((m) => m.id),
  anthropic: PROVIDER_MODEL_DETAILS.anthropic.map((m) => m.id),
  gemini: PROVIDER_MODEL_DETAILS.gemini.map((m) => m.id),
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
  suggestedNewCollectionNames?: string[];
}

export interface AnalysisProvider {
  id: ProviderId;
  analyze(req: AnalysisRequest): Promise<RawAnalysisResult | null>;
}
