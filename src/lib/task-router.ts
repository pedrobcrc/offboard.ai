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