import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.AI_KEY_ENCRYPTION_SECRET =
  process.env.AI_KEY_ENCRYPTION_SECRET ?? "test-secret-aaaaaaaaaaaaaaaaaaaaaaaa";
process.env.AI_INTEGRATIONS_OPENAI_API_KEY = "fallback-openai-key";
process.env.AI_INTEGRATIONS_OPENAI_BASE_URL = "https://fallback.openai.example/";
process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY = "fallback-anthropic-key";
process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL =
  "https://fallback.anthropic.example/";
process.env.AI_INTEGRATIONS_GEMINI_API_KEY = "fallback-gemini-key";
process.env.AI_INTEGRATIONS_GEMINI_BASE_URL = "https://fallback.gemini.example/";

const hoisted = vi.hoisted(() => ({
  openaiCreate: vi.fn(),
  anthropicCreate: vi.fn(),
  geminiGenerate: vi.fn(),
  openaiInstances: [] as Array<{ apiKey: string; baseURL?: string }>,
  anthropicInstances: [] as Array<{ apiKey: string; baseURL?: string }>,
  geminiInstances: [] as Array<{ apiKey: string; baseUrl?: string }>,
  dbState: { settings: null as Record<string, unknown> | null },
}));

vi.mock("openai", () => ({
  default: class FakeOpenAI {
    apiKey: string;
    baseURL?: string;
    chat = { completions: { create: hoisted.openaiCreate } };
    constructor(opts: { apiKey: string; baseURL?: string }) {
      this.apiKey = opts.apiKey;
      this.baseURL = opts.baseURL;
      hoisted.openaiInstances.push(this);
    }
  },
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class FakeAnthropic {
    apiKey: string;
    baseURL?: string;
    messages = { create: hoisted.anthropicCreate };
    constructor(opts: { apiKey: string; baseURL?: string }) {
      this.apiKey = opts.apiKey;
      this.baseURL = opts.baseURL;
      hoisted.anthropicInstances.push(this);
    }
  },
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class FakeGemini {
    apiKey: string;
    baseUrl?: string;
    models = { generateContent: hoisted.geminiGenerate };
    constructor(opts: { apiKey: string; httpOptions?: { baseUrl?: string } }) {
      this.apiKey = opts.apiKey;
      this.baseUrl = opts.httpOptions?.baseUrl;
      hoisted.geminiInstances.push(this);
    }
  },
  Type: {
    OBJECT: "OBJECT",
    STRING: "STRING",
    ARRAY: "ARRAY",
    INTEGER: "INTEGER",
  },
}));

vi.mock("@workspace/db", () => {
  const appSettingsTable = { id: "id" } as unknown;
  const db = {
    select: () => ({
      from: () => ({
        where: () =>
          Promise.resolve(
            hoisted.dbState.settings ? [hoisted.dbState.settings] : [],
          ),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve([hoisted.dbState.settings]),
      }),
    }),
  };
  return {
    db,
    appSettingsTable,
    APP_SETTINGS_SINGLETON_ID: 1,
  };
});

vi.mock("../objectStorage", () => ({
  ObjectStorageService: class {
    async getObjectEntityFile() {
      throw new Error("not used in tests");
    }
  },
}));

import { analyzePhoto } from "../aiPhotoAnalysis";
import { encryptSecret } from "../secretCrypto";

const IMAGE = "data:image/jpeg;base64,AAAA";

function baseSettings(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    aiEnabled: true,
    activeProvider: "openai",
    openaiKeyCiphertext: null,
    openaiKeyIv: null,
    openaiKeyTag: null,
    openaiKeyPreview: null,
    anthropicKeyCiphertext: null,
    anthropicKeyIv: null,
    anthropicKeyTag: null,
    anthropicKeyPreview: null,
    geminiKeyCiphertext: null,
    geminiKeyIv: null,
    geminiKeyTag: null,
    geminiKeyPreview: null,
    updatedAt: new Date(),
    ...overrides,
  };
}

function adminKey(
  provider: "openai" | "anthropic" | "gemini",
  plaintext: string,
) {
  const enc = encryptSecret(plaintext);
  if (provider === "openai") {
    return {
      openaiKeyCiphertext: enc.ciphertext,
      openaiKeyIv: enc.iv,
      openaiKeyTag: enc.tag,
      openaiKeyPreview: "abc…1234",
    };
  }
  if (provider === "anthropic") {
    return {
      anthropicKeyCiphertext: enc.ciphertext,
      anthropicKeyIv: enc.iv,
      anthropicKeyTag: enc.tag,
      anthropicKeyPreview: "abc…1234",
    };
  }
  return {
    geminiKeyCiphertext: enc.ciphertext,
    geminiKeyIv: enc.iv,
    geminiKeyTag: enc.tag,
    geminiKeyPreview: "abc…1234",
  };
}

beforeEach(() => {
  hoisted.openaiCreate.mockReset();
  hoisted.anthropicCreate.mockReset();
  hoisted.geminiGenerate.mockReset();
  hoisted.openaiInstances.length = 0;
  hoisted.anthropicInstances.length = 0;
  hoisted.geminiInstances.length = 0;
  hoisted.dbState.settings = null;

  hoisted.openaiCreate.mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            description: "ok",
            suggestedCollectionIds: [],
          }),
        },
      },
    ],
  });
  hoisted.anthropicCreate.mockResolvedValue({
    content: [
      {
        type: "tool_use",
        input: {
          description: "ok",
          suggestedCollectionIds: [],
        },
      },
    ],
  });
  hoisted.geminiGenerate.mockResolvedValue({
    text: JSON.stringify({
      description: "ok",
      suggestedCollectionIds: [],
    }),
  });

  process.env.AI_INTEGRATIONS_OPENAI_API_KEY = "fallback-openai-key";
  process.env.AI_INTEGRATIONS_OPENAI_BASE_URL =
    "https://fallback.openai.example/";
  process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY = "fallback-anthropic-key";
  process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL =
    "https://fallback.anthropic.example/";
  process.env.AI_INTEGRATIONS_GEMINI_API_KEY = "fallback-gemini-key";
  process.env.AI_INTEGRATIONS_GEMINI_BASE_URL =
    "https://fallback.gemini.example/";
});

describe("AI provider routing on photo upload", () => {
  it("calls no provider when AI is globally disabled", async () => {
    hoisted.dbState.settings = baseSettings({
      aiEnabled: false,
      activeProvider: "openai",
      ...adminKey("openai", "sk-admin-openai"),
    });

    const result = await analyzePhoto(IMAGE, [], null);

    expect(result.status).toBe("skipped");
    expect(hoisted.openaiCreate).not.toHaveBeenCalled();
    expect(hoisted.anthropicCreate).not.toHaveBeenCalled();
    expect(hoisted.geminiGenerate).not.toHaveBeenCalled();
  });

  it("routes to OpenAI with the admin-configured key when active", async () => {
    hoisted.dbState.settings = baseSettings({
      activeProvider: "openai",
      ...adminKey("openai", "sk-admin-openai"),
    });

    await analyzePhoto(IMAGE, [], null);

    expect(hoisted.openaiCreate).toHaveBeenCalledTimes(1);
    expect(hoisted.anthropicCreate).not.toHaveBeenCalled();
    expect(hoisted.geminiGenerate).not.toHaveBeenCalled();
    expect(hoisted.openaiInstances).toHaveLength(1);
    expect(hoisted.openaiInstances[0].apiKey).toBe("sk-admin-openai");
    expect(hoisted.openaiInstances[0].baseURL).toBeUndefined();
  });

  it("routes to Anthropic with the admin-configured key when active", async () => {
    hoisted.dbState.settings = baseSettings({
      activeProvider: "anthropic",
      ...adminKey("anthropic", "sk-admin-anthropic"),
    });

    await analyzePhoto(IMAGE, [], null);

    expect(hoisted.anthropicCreate).toHaveBeenCalledTimes(1);
    expect(hoisted.openaiCreate).not.toHaveBeenCalled();
    expect(hoisted.geminiGenerate).not.toHaveBeenCalled();
    expect(hoisted.anthropicInstances).toHaveLength(1);
    expect(hoisted.anthropicInstances[0].apiKey).toBe("sk-admin-anthropic");
    expect(hoisted.anthropicInstances[0].baseURL).toBeUndefined();
  });

  it("routes to Gemini with the admin-configured key when active", async () => {
    hoisted.dbState.settings = baseSettings({
      activeProvider: "gemini",
      ...adminKey("gemini", "AIza-admin-gemini"),
    });

    await analyzePhoto(IMAGE, [], null);

    expect(hoisted.geminiGenerate).toHaveBeenCalledTimes(1);
    expect(hoisted.openaiCreate).not.toHaveBeenCalled();
    expect(hoisted.anthropicCreate).not.toHaveBeenCalled();
    expect(hoisted.geminiInstances).toHaveLength(1);
    expect(hoisted.geminiInstances[0].apiKey).toBe("AIza-admin-gemini");
    expect(hoisted.geminiInstances[0].baseUrl).toBeUndefined();
  });

  it("falls back to Replit's built-in OpenAI when no admin key is set", async () => {
    hoisted.dbState.settings = baseSettings({ activeProvider: "openai" });

    await analyzePhoto(IMAGE, [], null);

    expect(hoisted.openaiCreate).toHaveBeenCalledTimes(1);
    expect(hoisted.anthropicCreate).not.toHaveBeenCalled();
    expect(hoisted.geminiGenerate).not.toHaveBeenCalled();
    expect(hoisted.openaiInstances).toHaveLength(1);
    expect(hoisted.openaiInstances[0].apiKey).toBe("fallback-openai-key");
    expect(hoisted.openaiInstances[0].baseURL).toBe(
      "https://fallback.openai.example/",
    );
  });

  it("silently skips when the active provider has no admin key and no Replit fallback", async () => {
    delete process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
    delete process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
    hoisted.dbState.settings = baseSettings({ activeProvider: "anthropic" });

    const result = await analyzePhoto(IMAGE, [], null);

    expect(result.status).toBe("skipped");
    expect(hoisted.openaiCreate).not.toHaveBeenCalled();
    expect(hoisted.anthropicCreate).not.toHaveBeenCalled();
    expect(hoisted.geminiGenerate).not.toHaveBeenCalled();
  });

  it("does not route to a non-active provider even if its admin key is set", async () => {
    hoisted.dbState.settings = baseSettings({
      activeProvider: "anthropic",
      ...adminKey("anthropic", "sk-anthropic"),
      ...adminKey("openai", "sk-openai"),
      ...adminKey("gemini", "AIza-gemini"),
    });

    await analyzePhoto(IMAGE, [], null);

    expect(hoisted.anthropicCreate).toHaveBeenCalledTimes(1);
    expect(hoisted.openaiCreate).not.toHaveBeenCalled();
    expect(hoisted.geminiGenerate).not.toHaveBeenCalled();
  });
});

describe("new-collection name suggestions", () => {
  beforeEach(() => {
    hoisted.dbState.settings = baseSettings({ activeProvider: "openai" });
  });

  it("returns suggestedNewCollectionNames when no existing collections match", async () => {
    hoisted.openaiCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              description: "A sunset over mountains",
              suggestedCollectionIds: [],
              suggestedTags: [],
              suggestedNewCollectionNames: ["Landscape Photos", "Nature Scenes"],
            }),
          },
        },
      ],
    });

    const outcome = await analyzePhoto(IMAGE, [], null);

    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;
    expect(outcome.result.suggestedNewCollectionNames).toEqual([
      "Landscape Photos",
      "Nature Scenes",
    ]);
    expect(outcome.result.suggestedCollectionIds).toEqual([]);
  });

  it("clears suggestedNewCollectionNames when existing collection IDs match (priority rule)", async () => {
    hoisted.openaiCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              description: "Team event photo",
              suggestedCollectionIds: [42],
              suggestedTags: [],
              suggestedNewCollectionNames: ["Team Events", "Office Life"],
            }),
          },
        },
      ],
    });

    const collections = [{ id: 42, title: "Events", description: null }];
    const outcome = await analyzePhoto(IMAGE, collections, null);

    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;
    expect(outcome.result.suggestedCollectionIds).toEqual([42]);
    expect(outcome.result.suggestedNewCollectionNames).toEqual([]);
  });

  it("sanitizes names: drops empty/overly-long strings and caps at 2", async () => {
    const longName = "A".repeat(81);
    hoisted.openaiCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              description: "misc photo",
              suggestedCollectionIds: [],
              suggestedTags: [],
              suggestedNewCollectionNames: [
                "",
                longName,
                "Valid Name One",
                "Valid Name Two",
                "Valid Name Three",
              ],
            }),
          },
        },
      ],
    });

    const outcome = await analyzePhoto(IMAGE, [], null);

    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;
    expect(outcome.result.suggestedNewCollectionNames).toEqual([
      "Valid Name One",
      "Valid Name Two",
    ]);
  });

  it("returns empty suggestedNewCollectionNames when AI omits the field", async () => {
    hoisted.openaiCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              description: "photo with no new suggestions",
              suggestedCollectionIds: [],
              suggestedTags: [],
            }),
          },
        },
      ],
    });

    const outcome = await analyzePhoto(IMAGE, [], null);

    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;
    expect(outcome.result.suggestedNewCollectionNames).toEqual([]);
  });
});
