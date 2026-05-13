import OpenAI from "openai";
import { logger } from "../logger";
import {
  AnalysisProvider,
  AnalysisRequest,
  DEFAULT_PROVIDER_MODELS,
  RawAnalysisResult,
} from "./types";

export class OpenAIProvider implements AnalysisProvider {
  id = "openai" as const;
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, baseURL?: string | null, model?: string | null) {
    this.client = new OpenAI({ apiKey, baseURL: baseURL ?? undefined });
    this.model = model || DEFAULT_PROVIDER_MODELS.openai;
  }

  async analyze(req: AnalysisRequest): Promise<RawAnalysisResult | null> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_completion_tokens: 8192,
        messages: [
          { role: "system", content: req.systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: req.userText },
              { type: "image_url", image_url: { url: req.imageDataUrl } },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "photo_analysis",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                description: { type: "string" },
                suggestedCollectionIds: {
                  type: "array",
                  items: { type: "integer" },
                  maxItems: 3,
                },
                suggestedNewCollectionNames: {
                  type: "array",
                  items: { type: "string" },
                  maxItems: 2,
                },
              },
              required: ["description", "suggestedCollectionIds", "suggestedNewCollectionNames"],
            },
          },
        },
      });

      const raw = response.choices[0]?.message?.content;
      if (!raw) return null;
      const parsed = JSON.parse(raw) as RawAnalysisResult;
      return {
        description: String(parsed.description ?? "").trim(),
        suggestedCollectionIds: Array.isArray(parsed.suggestedCollectionIds)
          ? parsed.suggestedCollectionIds
          : [],
        suggestedNewCollectionNames: Array.isArray(parsed.suggestedNewCollectionNames)
          ? parsed.suggestedNewCollectionNames.map((n) => String(n).trim()).filter(Boolean)
          : [],
      };
    } catch (err) {
      logger.error({ err }, "OpenAI photo analysis failed");
      return null;
    }
  }
}
