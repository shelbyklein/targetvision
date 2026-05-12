import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../logger";
import {
  AnalysisProvider,
  AnalysisRequest,
  DEFAULT_PROVIDER_MODELS,
  RawAnalysisResult,
} from "./types";

const TOOL_NAME = "submit_photo_analysis";

function extractBase64FromDataUrl(dataUrl: string): {
  mediaType: string;
  data: string;
} | null {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!match) return null;
  return { mediaType: match[1], data: match[2] };
}

export class AnthropicProvider implements AnalysisProvider {
  id = "anthropic" as const;
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, baseURL?: string | null, model?: string | null) {
    this.client = new Anthropic({ apiKey, baseURL: baseURL ?? undefined });
    this.model = model || DEFAULT_PROVIDER_MODELS.anthropic;
  }

  async analyze(req: AnalysisRequest): Promise<RawAnalysisResult | null> {
    try {
      const img = extractBase64FromDataUrl(req.imageDataUrl);
      if (!img) {
        logger.warn("Anthropic provider needs base64 data URL; falling back to URL");
      }

      const imageBlock: Anthropic.Messages.ImageBlockParam = img
        ? {
            type: "image",
            source: {
              type: "base64",
              media_type: img.mediaType as
                | "image/jpeg"
                | "image/png"
                | "image/gif"
                | "image/webp",
              data: img.data,
            },
          }
        : {
            type: "image",
            source: { type: "url", url: req.imageDataUrl },
          };

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: req.systemPrompt,
        tools: [
          {
            name: TOOL_NAME,
            description:
              "Submit a photo description and a list of suggested collection ids.",
            input_schema: {
              type: "object",
              properties: {
                description: { type: "string" },
                suggestedCollectionIds: {
                  type: "array",
                  items: { type: "integer" },
                  maxItems: 3,
                },
                suggestedTags: {
                  type: "array",
                  items: { type: "string" },
                  maxItems: 5,
                },
                suggestedCategoryIds: {
                  type: "array",
                  items: { type: "integer" },
                  maxItems: 2,
                },
              },
              required: ["description", "suggestedCollectionIds", "suggestedTags", "suggestedCategoryIds"],
            },
          },
        ],
        tool_choice: { type: "tool", name: TOOL_NAME },
        messages: [
          {
            role: "user",
            content: [imageBlock, { type: "text", text: req.userText }],
          },
        ],
      });

      const toolUse = response.content.find(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
      );
      if (!toolUse) return null;
      const input = toolUse.input as RawAnalysisResult;
      return {
        description: String(input.description ?? "").trim(),
        suggestedCollectionIds: Array.isArray(input.suggestedCollectionIds)
          ? input.suggestedCollectionIds
          : [],
        suggestedTags: Array.isArray(input.suggestedTags)
          ? input.suggestedTags
          : [],
        suggestedCategoryIds: Array.isArray(input.suggestedCategoryIds)
          ? input.suggestedCategoryIds
          : [],
      };
    } catch (err) {
      logger.error({ err }, "Anthropic photo analysis failed");
      return null;
    }
  }
}
