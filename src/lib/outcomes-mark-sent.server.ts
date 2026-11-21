import { z } from "zod";
import { authorizeOutcomes, outcomesJson } from "@/lib/outcomes.server";

const itemSchema = z.object({
  proposal_id: z.string().uuid(),
  task_id: z.string().uuid(),
  offboarding_id: z.string().uuid(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }),
});
const bodySchema = z.object({ items: z.array(itemSchema).min(1) });

export async function handleOutcomesMarkSent(request: Request): Promise<Response> {
  const unauthorized = await authorizeOutcomes(request);
  if (unauthorized) return unauthorized;
  let items: z.infer<typeof itemSchema>[];
  try {
    items = bodySchema.parse(await request.json()).items;
  } catch {
    return outcomesJson({ error: "Expected a nonempty items array, each with proposal_id, task_id, offboarding_id UUIDs and a valid YYYY-MM-DD due_date" }, 400);
  }
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("n8n_outcomes_mark_sent", { p_items: items });
    if (error) return outcomesJson({ error: "Unable to mark outcomes sent" }, 500);
    return outcomesJson({ inserted: data ?? 0 });
  } catch {
    return outcomesJson({ error: "Unable to mark outcomes sent" }, 500);
  }
}