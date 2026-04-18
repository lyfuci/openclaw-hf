# @lyfuci/openclaw-hf

[![npm](https://img.shields.io/npm/v/@lyfuci/openclaw-hf)](https://www.npmjs.com/package/@lyfuci/openclaw-hf)
[![GitHub](https://img.shields.io/badge/GitHub-lyfuci%2Fopenclaw--hf-blue?logo=github)](https://github.com/lyfuci/openclaw-hf)

Complete [Hugging Face Inference Providers](https://huggingface.co/docs/inference-providers) plugin for [OpenClaw](https://docs.openclaw.ai) — covers all HF capability areas under a single HF API token.

| Capability | Provider route | Default model |
|---|---|---|
| **LLM chat** | `router.huggingface.co/v1` (OpenAI-compat) | any model in your config |
| **Image generation** | `hf-inference/models/<id>` | `black-forest-labs/FLUX.1-schnell` |
| **Memory embeddings** | `scaleway/v1/embeddings` | `Qwen/Qwen3-Embedding-8B` |
| **Audio transcription** | `hf-inference/models/<id>` | `openai/whisper-large-v3` |
| **Video generation** | `replicate/v1/models/<id>` | `Wan-AI/Wan2.2-T2V-A14B` |

HF Pro $2/month free tier covers all routes. No separate accounts needed.

## Install

```bash
openclaw plugins install @lyfuci/openclaw-hf
```

## Configure

Add an `hf` provider section to your `openclaw.json`:

```json
{
  "models": {
    "providers": {
      "hf": {
        "baseUrl": "https://router.huggingface.co/v1",
        "api": "openai-completions",
        "apiKey": { "source": "env", "id": "HUGGINGFACE_HUB_TOKEN" },
        "models": [
          {
            "id": "deepseek-ai/DeepSeek-V3-0324",
            "name": "DeepSeek V3 (HF)",
            "api": "openai-completions",
            "contextWindow": 131072,
            "maxTokens": 8192,
            "compat": { "supportsUsageInStreaming": true }
          },
          {
            "id": "Qwen/Qwen3-235B-A22B",
            "name": "Qwen3 235B (HF)",
            "api": "openai-completions",
            "contextWindow": 131072,
            "maxTokens": 8192,
            "compat": { "supportsUsageInStreaming": true }
          }
        ]
      }
    }
  }
}
```

> **Note:** always add `"compat": {"supportsUsageInStreaming": true}` to each model — without it OpenClaw forces token counts to 0 for non-OpenAI-native endpoints.

Set your token:

```bash
export HUGGINGFACE_HUB_TOKEN=hf_...
```

Or add it via:

```bash
openclaw auth login --provider hf --method api-key
```

## Image generation

Switch your image model to use this provider:

```json
{
  "agents": {
    "defaults": {
      "imageModel": { "primary": "hf/black-forest-labs/FLUX.1-schnell" }
    }
  }
}
```

## Memory embeddings

Switch semantic memory search to this provider:

```json
{
  "agents": {
    "defaults": {
      "memorySearch": {
        "provider": "hf",
        "model": "qwen3-embedding-8b"
      }
    }
  }
}
```

## Video generation

Supported Wan models (HF Pro, via replicate): `Wan-AI/Wan2.1-T2V-14B`, `Wan-AI/Wan2.1-T2V-1.3B`, `Wan-AI/Wan2.2-T2V-A14B`, `Wan-AI/Wan2.2-TI2V-5B`.

## Notes

- fal-ai routes (HunyuanVideo, Mochi, CogVideoX) require separate fal.ai pre-paid credits — not covered by HF Pro
- STT uses the raw bytes endpoint on hf-inference; not the OpenAI `/audio/transcriptions` path
- Embedding dimensions: 4096 (Qwen3-Embedding-8B via Scaleway)

## License

MIT
