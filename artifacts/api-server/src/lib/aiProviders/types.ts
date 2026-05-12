export type ProviderId = "openai" | "anthropic" | "gemini";

export const PROVIDER_IDS: ProviderId[] = ["openai", "anthropic", "gemini"];

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
};

export const PROVIDER_MODELS: Record<ProviderId, string> = {
  openai: "gpt-5-mini",
  anthropic: "claude-sonnet-4-6",
  gemini: "gemini-2.5-flash",
};

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
