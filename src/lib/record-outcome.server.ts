import { z } from "zod";
import { authorizeOutcomes, outcomesJson } from "@/lib/outcomes.server";
import type { Database } from "@/integrations/supabase/types";

const bodySchema = z.object({
  proposal_id: z.string({ required_error: "proposal_id is required" }).uuid("proposal_id must be a valid UUID"),
  worked: z.enum(["yes", "partly", "no"], { errorMap: () => ({ message: "worked must be yes, partly, or no" }) }),
  supplier_term_lost: z.boolean({ required_error: "supplier_term_lost is required", invalid_type_error: "supplier_term_lost must be a boolean" }),
  comment: z.string({ invalid_type_error: "comment must be a string or null" }).max(2000, "comment must be at most 2000 characters").nullable().optional(),
});

export async function handleRecordOutcome(request: Request): Promise<Response> {
  const unauthorized = await authorizeOutcomes(request);
  if (unauthorized) return unauthorized;
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (error) {
    return outcomesJson({ error: error instanceof z.ZodError ? error.issues[0]?.message ?? "Invalid input" : "Request body must be valid JSON" }, 400);
  }
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("n8n_outcome_record", {
      p_proposal_id: body.proposal_id,
      p_worked: body.worked,
      p_supplier_term_lost: body.supplier_term_lost,
      p_comment: body.comment ?? null,
      // Generated RPC types omit SQL parameter nullability; preserve an actual SQL NULL.
    } as Database["public"]["Functions"]["n8n_outcome_record"]["Args"]);
    if (error || !data || typeof data !== "object" || Array.isArray(data)) {
      return outcomesJson({ error: "Unable to record outcome" }, 500);
    }
    if (data["error"] === "not_found") return outcomesJson({ error: "not_found" }, 404);
    if (data["error"] === "already_answered") return outcomesJson({ error: "already_answered" }, 409);
    if (data["updated"] !== 1 || !data["row"]) return outcomesJson({ error: "Unable to record outcome" }, 500);
    return outcomesJson(data);
  } catch {
    return outcomesJson({ error: "Unable to record outcome" }, 500);
  }
}