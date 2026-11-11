// Server-only Lovable AI Gateway helper. Never import this from a component or route:
// it reads LOVABLE_API_KEY from the server environment.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GATEWAY_MODELS_URL = "https://ai.gateway.lovable.dev/v1/models";
const RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

/** The user asked for this exact model; it is listed in the workspace catalogue. */
export const AI_MODEL = "google/gemini-2.5-flash";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type GatewayResult = { ok: true; text: string } | { ok: false; message: string };

/**
 * Resends a gateway-issued run id on follow-up calls and captures a minted one.
 * Run ids are never invented in app code.
 */
export function createLovableAiGatewayRunIdFetch(initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  return {
    getRunId: () => runId,
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(RUN_ID_HEADER)) headers.set(RUN_ID_HEADER, runId);
      const response = await fetch(input, { ...init, headers });
      runId ??= response.headers.get(RUN_ID_HEADER)?.trim() || undefined;
      return response;
    },
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function safeMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: { message?: string };
      message?: string;
      props?: { retryable?: boolean };
    };
    return body?.error?.message || body?.message || "";
  } catch {
    return "";
  }
}

/** Reads an SSE chat-completion stream and returns the accumulated answer text. */
async function readStreamedText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The AI service returned no stream.");
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      for (const line of frame.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const parsed = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (typeof delta === "string") text += delta;
        } catch {
          // Incomplete frame: keep it buffered until the next read.
        }
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
  return text;
}

/**
 * One chat-completion call. Streams even though only the final text is returned, so a
 * slow answer cannot be billed twice by a buffered retry. Only 429/5xx are retried.
 */
export async function askGateway(messages: ChatMessage[], maxTokens = 500): Promise<GatewayResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { ok: false, message: "AI is not configured for this workspace." };

  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const attempts = 3;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await runIdFetch.fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages,
          max_tokens: maxTokens,
          stream: true,
        }),
      });

      if (response.ok) {
        const text = (await readStreamedText(response)).trim();
        if (!text) return { ok: false, message: "The AI service returned an empty answer." };
        return { ok: true, text };
      }

      const message = await safeMessage(response);
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable) {
        return { ok: false, message: message || `The AI service rejected the request (${response.status}).` };
      }
      if (attempt === attempts - 1) {
        return { ok: false, message: message || "The AI service is busy right now." };
      }
      const retryAfter = Number(response.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 600 * (attempt + 1));
    } catch {
      if (attempt === attempts - 1) return { ok: false, message: "Could not reach the AI service." };
      await sleep(600 * (attempt + 1));
    }
  }
  return { ok: false, message: "Could not reach the AI service." };
}

/** Whether the workspace can still pay for AI calls — used to warn before a request. */
export async function checkAiAvailability(): Promise<{ ok: true } | { ok: false; message: string }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { ok: false, message: "AI is not configured for this workspace." };
  try {
    const response = await fetch(GATEWAY_MODELS_URL, {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    if (response.ok) return { ok: true };
    return { ok: false, message: (await safeMessage(response)) || `AI is unavailable (${response.status}).` };
  } catch {
    return { ok: false, message: "Could not reach the AI service." };
  }
}
