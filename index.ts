// openclaw-hf — complete Hugging Face Inference Providers plugin for OpenClaw.
//
// Covers all HF capability areas in a single HF API token:
//
//   LLM chat     — add models under models.providers.hf (api: "openai-completions",
//                  baseUrl: "https://router.huggingface.co/v1") in openclaw.json.
//                  openclaw handles streaming automatically for any openai-compat provider.
//
//   Image gen    — FLUX.1-schnell / FLUX.1-dev via hf-inference (free tier)
//   Embeddings   — Qwen3-Embedding-8B via Scaleway (free tier)
//   STT          — whisper-large-v3 via hf-inference (free tier)
//   Video gen    — Wan 2.1/2.2 family via replicate (HF Pro credits)

import { PROVIDER_ID, createProviderApiKeyAuthMethod, definePluginEntry } from "./api.js";
import { hfEmbeddingProviderAdapter } from "./embeddings-provider.js";
import { buildHfImageGenerationProvider } from "./image-generation-provider.js";
import { hfMediaUnderstandingProvider } from "./stt-provider.js";
import { buildHfVideoGenerationProvider } from "./video-generation-provider.js";

export default definePluginEntry({
  id: "openclaw-hf",
  name: "Hugging Face (HF)",
  description:
    "Complete Hugging Face Inference Providers plugin — LLM chat, image gen, embeddings, STT, and video under one HF token.",
  register(api) {
    api.registerProvider({
      id: PROVIDER_ID,
      label: "Hugging Face",
      docsPath: "/providers/huggingface",
      envVars: ["HUGGINGFACE_HUB_TOKEN", "HF_TOKEN"],
      auth: [
        createProviderApiKeyAuthMethod({
          providerId: PROVIDER_ID,
          methodId: "api-key",
          label: "Hugging Face API key",
          hint: "LLM chat / image gen / embeddings / STT / video via HF Inference API",
          optionKey: "hfApiKey",
          flagName: "--hf-api-key",
          envVar: "HUGGINGFACE_HUB_TOKEN",
          promptMessage: "Enter Hugging Face API key (HF token)",
          expectedProviders: [PROVIDER_ID],
          wizard: {
            choiceId: "hf-api-key",
            choiceLabel: "Hugging Face API key",
            choiceHint: "LLM chat / image gen / embeddings / STT / video via HF Inference API",
            groupId: "hf",
            groupLabel: "Hugging Face",
            groupHint: "Complete HF Inference Providers plugin",
            onboardingScopes: ["image-generation"],
          },
        }),
      ],
    });
    api.registerImageGenerationProvider(buildHfImageGenerationProvider());
    api.registerEmbeddingProvider(hfEmbeddingProviderAdapter);
    api.registerMediaUnderstandingProvider(hfMediaUnderstandingProvider);
    api.registerVideoGenerationProvider(buildHfVideoGenerationProvider());
  },
});
