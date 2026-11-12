import { describe, expect, it } from "vitest";
import { buyerEditSchema, isWorkloadWarning, modelAllocationSchema, projectedWorkload, taskLoad } from "@/lib/task-router";
describe("Task Router workload rules", () => {
  it("adds 10 percentage points for High criticality", () => expect(taskLoad("High")).toBe(10));
  it.each(["Medium", "Low"])("adds 5 percentage points for %s", (value) => expect(taskLoad(value)).toBe(5));
  it("projects Mike's 90% workload to 100% after one High task", () => expect(projectedWorkload(90, [{ criticality: "High" }])).toBe(100));
  it("warns above 90%, not at 90%", () => { expect(isWorkloadWarning(90)).toBe(false); expect(isWorkloadWarning(95)).toBe(true); });
  it("rejects an editable workload over 100%", () => expect(buyerEditSchema.safeParse({ id: "00000000-0000-4000-8000-000000000001", name: "Mike", expertise: "Plastics expert", capacity: 101 }).success).toBe(false));
  it("rejects rationales longer than 25 words", () => expect(modelAllocationSchema.safeParse([{ task_id: "00000000-0000-4000-8000-000000000001", assigned_buyer: "Ana", rationale: Array(26).fill("word").join(" "), confidence: "High", source_file: "notes.txt" }]).success).toBe(false));
  it("accepts only High/Medium/Low confidence", () => expect(modelAllocationSchema.safeParse([{ task_id: "00000000-0000-4000-8000-000000000001", assigned_buyer: "Ana", rationale: "ChemSol experience", confidence: "Certain", source_file: "notes.txt" }]).success).toBe(false));
});