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