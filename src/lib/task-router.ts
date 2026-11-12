import { z } from "zod";

export const prioritySchema = z.enum(["High", "Medium", "Low"]);
export type Criticality = z.infer<typeof prioritySchema>;
export const buyerEditSchema = z.object({
  id: z.string().uuid(), name: z.string().trim().min(1).max(80),
  expertise: z.string().trim().min(1).max(160), capacity: z.number().int().min(0).max(100),
});
export const modelAllocationSchema = z.array(z.object({
  task_id: z.string().uuid(), assigned_buyer: z.string(),
  rationale: z.string().trim().min(1).refine((value) => value.split(/\s+/).length <= 25),
  confidence: prioritySchema, source_file: z.string().nullable(),
}));
export function taskLoad(criticality: string) { return criticality === "High" ? 10 : 5; }
export function isWorkloadWarning(workload: number) { return workload > 90; }
export function projectedWorkload(base: number, tasks: { criticality: string }[]) {
  return base + tasks.reduce((sum, task) => sum + taskLoad(task.criticality), 0);
}
type AllocationContext = {
  tasks: { id: string; criticality: string }[];
  buyers: { id: string; name: string; currentWorkload: number }[];
  evidence: { task_id: string; chunks: { filename: string }[] }[];
};
export function validateAllocations(text: string, context: AllocationContext) {
  let entries: z.infer<typeof modelAllocationSchema>;
  try {
    const parsed: unknown = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
    entries = modelAllocationSchema.parse(Array.isArray(parsed) ? parsed : (parsed as { allocations?: unknown } | null)?.allocations);
  } catch { throw new Error("The AI returned an incomplete or invalid allocation. No tasks were changed."); }
  if (entries.length !== context.tasks.length || new Set(entries.map((entry) => entry.task_id)).size !== context.tasks.length) {
    throw new Error(`The AI must assign all ${context.tasks.length} tasks exactly once. No tasks were changed.`);
  }
  const payload = entries.map((entry) => {
    const task = context.tasks.find((task) => task.id === entry.task_id);
    const buyer = context.buyers.find((buyer) => buyer.name === entry.assigned_buyer);
    const chunks = context.evidence.find((item) => item.task_id === entry.task_id)?.chunks ?? [];
    if (!task || !buyer || (chunks.length ? !chunks.some((chunk) => chunk.filename === entry.source_file) : entry.source_file !== null)) {
      throw new Error("The AI returned an unknown buyer, task or source. No tasks were changed.");
    }
    return { task_id: task.id, buyer_id: buyer.id, rationale: entry.rationale, confidence: entry.confidence, source_file: entry.source_file };
  });
  for (const buyer of context.buyers) {
    const newTasks = context.tasks.filter((task) => payload.some((entry) => entry.task_id === task.id && entry.buyer_id === buyer.id));
    if (projectedWorkload(buyer.currentWorkload, newTasks) > 100) {
      throw new Error(`The AI exceeded 100% workload for ${buyer.name}. No tasks were changed.`);
    }
  }
  return { entries, payload };
}
/** Only successful model responses that fail local validation receive one correction attempt. */
export async function allocateWithRetry(
  callModel: (validationError?: string) => Promise<{ ok: true; text: string } | { ok: false; message: string }>,
  context: AllocationContext,
) {
  let validationError: string | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await callModel(validationError);
    if (!result.ok) return result;
    try { return { ok: true as const, ...validateAllocations(result.text, context) }; }
    catch (error) { validationError = error instanceof Error ? error.message : "Invalid allocation."; }
  }
  return { ok: false as const, message: validationError ?? "Invalid allocation." };
}
export const reviewSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), taskId: z.string().uuid() }),
  z.object({ action: z.literal("reassign"), taskId: z.string().uuid(), buyerId: z.string().uuid(), reason: z.string().trim().min(10) }),
  z.object({ action: z.literal("reject"), taskId: z.string().uuid(), reason: z.string().trim().min(10) }),
]);
export function reviewMetrics(tasks: { status: string }[], decisions: { action: string; proposal_id: string }[]) {
  const proposals = new Set(decisions.filter((d) => d.action === "propose").map((d) => d.proposal_id));
  const overrides = new Set(decisions.filter((d) => d.action === "reassign" || d.action === "reject").map((d) => d.proposal_id));
  return { approved: tasks.filter((task) => task.status === "approved").length, total: tasks.length,
    overrideRate: proposals.size ? Math.round(overrides.size / proposals.size * 100) : 0,
    hoursSaved: tasks.filter((task) => task.status === "approved").length * (6 - 0.5) };
}