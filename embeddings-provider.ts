// Hugging Face Inference Providers embeddings adapter.
//
// Routes through Scaleway's OpenAI-compatible `/v1/embeddings` endpoint
// because Scaleway is the inference provider that hosts Qwen3-Embedding-8B
// (the strongest open multilingual embedding currently on HF). Other
// embedding models on the same Scaleway route (e.g. `bge-multilingual-gemma2`)
// are accessible by overriding `memorySearch.model`.
//
// Registered via the modern `EmbeddingProviderAdapter` API
// (`api.registerEmbeddingProvider` + `contracts.embeddingProviders`). It plugs
// into the `agents.defaults.memorySearch.provider` config slot and returns an
// `EmbeddingProvider` with `embed` / `embedBatch` methods that openclaw's
// memory search and dreaming pipelines drive.

import {
  HUGGINGFACE_SCALEWAY_BASE_URL,
  PROVIDER_ID,
  resolveApiKeyForProvider,
  type EmbeddingInput,
  type EmbeddingProvider,
  type EmbeddingProviderAdapter,
  type EmbeddingProviderCallOptions,
  type EmbeddingProviderCreateOptions,
  type EmbeddingProviderCreateResult,
} from "./api.js";

const DEFAULT_MODEL = "qwen3-embedding-8b";

// Scaleway has its own short ids; the user may type either the friendly HF
// repo id or the short Scaleway id. We translate well-known repo ids on the
// way out so users can configure either form.
const REPO_ID_ALIASES: Readonly<Record<string, string>> = {
  "qwen/qwen3-embedding-8b": "qwen3-embedding-8b",
  "baai/bge-multilingual-gemma2": "bge-multilingual-gemma2",
};

function normalizeModel(raw: string | undefined): string {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return DEFAULT_MODEL;
  }
  const alias = REPO_ID_ALIASES[trimmed.toLowerCase()];
  return alias ?? trimmed;
}

// The host may hand us a plain string or a structured `EmbeddingInput`. HF text
// embeddings only consume text, so we take the text and drop any non-text parts
// (e.g. inline images) — this provider is text-only.
function inputToText(input: EmbeddingInput): string {
  return typeof input === "string" ? input : input.text;
}

type EmbeddingsApiResponse = {
  object?: string;
  model?: string;
  data?: Array<{
    object?: string;
    index?: number;
    embedding?: number[];
  }>;
  error?: string | { message?: string };
};

function extractError(status: number, body: EmbeddingsApiResponse | string): string {
  if (typeof body === "string") {
    return body || `hf embeddings request failed with status ${status}`;
  }
  if (body.error) {
    if (typeof body.error === "string") {
      return body.error;
    }
    if (typeof body.error.message === "string") {
      return body.error.message;
    }
  }
  return `hf embeddings request failed with status ${status}`;
}

async function postEmbeddings(params: {
  apiKey: string;
  baseUrl: string;
  model: string;
  inputs: string[];
  signal?: AbortSignal;
}): Promise<number[][]> {
  const url = `${params.baseUrl}/v1/embeddings`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      input: params.inputs,
    }),
    signal: params.signal,
  });

  let body: EmbeddingsApiResponse | string;
  const text = await response.text().catch(() => "");
  try {
    body = JSON.parse(text) as EmbeddingsApiResponse;
  } catch {
    body = text;
  }

  if (!response.ok) {
    throw new Error(extractError(response.status, body));
  }
  if (typeof body === "string" || !body.data) {
    throw new Error("hf embeddings response is missing `data` array");
  }

  // Preserve input ordering: Scaleway returns entries in input order but the
  // OpenAI spec only guarantees order via the `index` field, so we sort
  // defensively before stripping the wrapper.
  const sorted = body.data.toSorted((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const vectors: number[][] = [];
  for (const entry of sorted) {
    if (!Array.isArray(entry.embedding)) {
      throw new Error("hf embeddings response entry is missing `embedding`");
    }
    vectors.push(entry.embedding);
  }
  return vectors;
}

function buildProvider(params: {
  apiKey: string;
  baseUrl: string;
  model: string;
}): EmbeddingProvider {
  return {
    id: PROVIDER_ID,
    model: params.model,
    embed: async (input: EmbeddingInput, options?: EmbeddingProviderCallOptions) => {
      const vectors = await postEmbeddings({
        ...params,
        inputs: [inputToText(input)],
        signal: options?.signal,
      });
      const first = vectors[0];
      if (!first) {
        throw new Error("hf embeddings returned no vectors for query");
      }
      return first;
    },
    embedBatch: async (inputs: EmbeddingInput[], options?: EmbeddingProviderCallOptions) => {
      if (inputs.length === 0) {
        return [];
      }
      return postEmbeddings({
        ...params,
        inputs: inputs.map(inputToText),
        signal: options?.signal,
      });
    },
  };
}

async function createEmbeddingProvider(
  options: EmbeddingProviderCreateOptions,
): Promise<EmbeddingProviderCreateResult> {
  const auth = await resolveApiKeyForProvider({
    provider: PROVIDER_ID,
    cfg: options.config,
    agentDir: options.agentDir,
  });
  const apiKey = auth?.apiKey;
  if (!apiKey) {
    throw new Error(
      "hf embeddings: HF API key not configured. Set HUGGINGFACE_HUB_TOKEN/HF_TOKEN or run `openclaw onboard --auth-choice hf-api-key`.",
    );
  }
  const baseUrl = options.remote?.baseUrl?.trim() || HUGGINGFACE_SCALEWAY_BASE_URL;
  const model = normalizeModel(options.model);
  return {
    provider: buildProvider({ apiKey, baseUrl, model }),
    runtime: {
      id: PROVIDER_ID,
      cacheKeyData: {
        provider: PROVIDER_ID,
        model,
        baseUrl,
      },
    },
  };
}

export const hfEmbeddingProviderAdapter: EmbeddingProviderAdapter = {
  id: PROVIDER_ID,
  defaultModel: DEFAULT_MODEL,
  transport: "remote",
  create: createEmbeddingProvider,
};
