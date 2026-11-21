export function outcomesJson(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

export async function authorizeOutcomes(request: Request): Promise<Response | null> {
  const expected = process.env["N8N_SHARED_SECRET"];
  const provided = request.headers.get("x-n8n-secret");
  if (!provided || !expected) return outcomesJson({ error: "Unauthorized" }, 401);
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= (left[i] ?? 0) ^ (right[i] ?? 0);
  if (difference !== 0) return outcomesJson({ error: "Unauthorized" }, 401);
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } });
  }
  return null;
}