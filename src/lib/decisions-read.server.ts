import { z } from "zod";

const filterSchema = z.object({ offboarding_id: z.string().uuid().optional() });
const columns = "id,task_id,proposal_id,task_title,action,ai_proposal,final_decision,reason,created_at,offboarding_id";

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

async function matchesSecret(provided: string, expected: string) {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return difference === 0;
}

export async function handleDecisionsRead(request: Request): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") {
    return new Response(null, { status: 405, headers: { Allow: "GET, POST", "Cache-Control": "no-store" } });
  }
  const expected = process.env["N8N_SHARED_SECRET"];
  const provided = request.headers.get("x-n8n-secret");
  if (!provided || !expected || !(await matchesSecret(provided, expected))) {
    return json({ error: "Unauthorized" }, 401);
  }

  let offboardingId: string | undefined;
  try {
    const query = new URL(request.url).searchParams.get("offboarding_id");
    const text = request.method === "POST" ? await request.text() : "";
    const body: unknown = text.trim() ? JSON.parse(text) : {};
    const parsedBody = filterSchema.parse(body);
    const filter = filterSchema.parse(query === null ? parsedBody : { offboarding_id: query });
    offboardingId = filter.offboarding_id;
  } catch {
    return json({ error: "Expected an optional UUID offboarding_id in the query or JSON body" }, 400);
  }

  try {
    // This privileged read is available only after shared-secret authorization.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = [];
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      let query = supabaseAdmin.from("task_decisions").select(columns)
        .order("created_at", { ascending: true }).order("id", { ascending: true });
      if (offboardingId) query = query.eq("offboarding_id", offboardingId);
      const { data, error } = await query.range(offset, offset + pageSize - 1);
      if (error) return json({ error: "Unable to read decisions" }, 500);
      rows.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
    }
    return json(rows);
  } catch {
    return json({ error: "Unable to read decisions" }, 500);
  }
}