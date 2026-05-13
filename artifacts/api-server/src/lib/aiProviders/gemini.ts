import { GoogleGenAI, Type } from "@google/genai";
import { logger } from "../logger";
import {
  AnalysisProvider,
  AnalysisRequest,
  DEFAULT_PROVIDER_MODELS,
  RawAnalysisResult,
} from "./types";

function extractBase64FromDataUrl(dataUrl: string): {
  mediaType: string;
  data: string;
} | null {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!match) return null;
  return { mediaType: match[1], data: match[2] };
}

export class GeminiProvider implements AnalysisProvider {
  id = "gemini" as const;
  private client: GoogleGenAI;
  private model: string;

  constructor(apiKey: string, baseUrl?: string, model?: string | null) {
    this.client = new GoogleGenAI({
      apiKey,
      ...(baseUrl ? { httpOptions: { baseUrl } } : {}),
    });
    this.model = model || DEFAULT_PROVIDER_MODELS.gemini;
  }

  async analyze(req: AnalysisRequest): Promise<RawAnalysisResult | null> {
    try {
      const img = extractBase64FromDataUrl(req.imageDataUrl);
      const parts: Array<Record<string, unknown>> = [
        { text: `${req.systemPrompt}\n\n${req.userText}` },
      ];
      if (img) {
        parts.push({
          inlineData: { mimeType: img.mediaType, data: img.data },
        });
      } else {
        parts.push({
          fileData: {
            mimeType: req.contentType || "image/jpeg",
            fileUri: req.imageDataUrl,
          },
        });
      }

      const response = await this.client.models.generateContent({
        model: this.model,
        contents: [{ role: "user", parts }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING },
              suggestedCollectionIds: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
              },
              suggestedNewCollectionNames: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ["description", "suggestedCollectionIds", "suggestedNewCollectionNames"],
          },
        },
      });

      const raw = response.text;
      if (!raw) return null;
      const parsed = JSON.parse(raw) as RawAnalysisResult;
      return {
        description: String(parsed.description ?? "").trim(),
        suggestedCollectionIds: Array.isArray(parsed.suggestedCollectionIds)
          ? parsed.suggestedCollectionIds.slice(0, 3)
          : [],
        suggestedNewCollectionNames: Array.isArray(parsed.suggestedNewCollectionNames)
          ? parsed.suggestedNewCollectionNames.map((n: unknown) => String(n).trim()).filter(Boolean).slice(0, 2)
          : [],
      };
    } catch (err) {
      logger.error({ err }, "Gemini photo analysis failed");
      return null;
    }
  }
}
