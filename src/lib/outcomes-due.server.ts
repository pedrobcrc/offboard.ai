import { z } from "zod";
import { authorizeOutcomes, outcomesJson } from "@/lib/outcomes.server";

const bodySchema = z.object({ days: z.number().int().min(0).max(365) });

export async function handleOutcomesDue(request: Request): Promise<Response> {
  const unauthorized = await authorizeOutcomes(request);
  if (unauthorized) return unauthorized;
  let days: number;
  try {
    days = bodySchema.parse(await request.json()).days;
  } catch {
    return outcomesJson({ error: "Expected days to be an integer from 0 to 365" }, 400);
  }
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("n8n_outcomes_due", { p_days: days });
    if (error) return outcomesJson({ error: "Unable to read due outcomes" }, 500);
    return outcomesJson({ rows: data ?? [] });
  } catch {
    return outcomesJson({ error: "Unable to read due outcomes" }, 500);
  }
}