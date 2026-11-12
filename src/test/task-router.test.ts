import { describe, expect, it, vi } from "vitest";
import { allocateWithRetry, buyerEditSchema, isWorkloadWarning, modelAllocationSchema, projectedWorkload, taskLoad, reviewSchema, reviewMetrics } from "@/lib/task-router";
describe("Task Router workload rules", () => {
  it("adds 10 percentage points for High criticality", () => expect(taskLoad("High")).toBe(10));
  it.each(["Medium", "Low"])("adds 5 percentage points for %s", (value) => expect(taskLoad(value)).toBe(5));
  it("projects Mike's 90% workload to 100% after one High task", () => expect(projectedWorkload(90, [{ criticality: "High" }])).toBe(100));
  it("warns above 90%, not at 90%", () => { expect(isWorkloadWarning(90)).toBe(false); expect(isWorkloadWarning(95)).toBe(true); });
  it("rejects an editable workload over 100%", () => expect(buyerEditSchema.safeParse({ id: "00000000-0000-4000-8000-000000000001", name: "Mike", expertise: "Plastics expert", capacity: 101 }).success).toBe(false));
  it("rejects rationales longer than 25 words", () => expect(modelAllocationSchema.safeParse([{ task_id: "00000000-0000-4000-8000-000000000001", assigned_buyer: "Ana", rationale: Array(26).fill("word").join(" "), confidence: "High", source_file: "notes.txt" }]).success).toBe(false));
  it("accepts only High/Medium/Low confidence", () => expect(modelAllocationSchema.safeParse([{ task_id: "00000000-0000-4000-8000-000000000001", assigned_buyer: "Ana", rationale: "ChemSol experience", confidence: "Certain", source_file: "notes.txt" }]).success).toBe(false));
});
describe("Allocation correction retry", () => {
  const taskId = "00000000-0000-4000-8000-000000000001";
  const context = { tasks: [{ id: taskId, criticality: "High" }], buyers: [{ id: "ana", name: "Ana", currentWorkload: 40 }, { id: "mike", name: "Mike", currentWorkload: 95 }], evidence: [{ task_id: taskId, chunks: [{ filename: "notes.txt" }] }] };
  const entry = { task_id: taskId, assigned_buyer: "Ana", rationale: "Relevant supplier experience", confidence: "High", source_file: "notes.txt" };
  const valid = { ok: true as const, text: JSON.stringify({ allocations: [entry] }) };
  it.each([
    ["invalid JSON", "not json", "invalid allocation"],
    ["unknown buyer", JSON.stringify([{ ...entry, assigned_buyer: "Unknown" }]), "unknown buyer"],
    ["unknown source", JSON.stringify([{ ...entry, source_file: "invented.txt" }]), "source"],
    ["over 100% workload", JSON.stringify([{ ...entry, assigned_buyer: "Mike" }]), "100% workload for Mike"],
    ["missing task", "[]", "all 1 tasks exactly once"],
  ])("retries %s once and sends the validation error", async (_label, text, error) => {
    const call = vi.fn().mockResolvedValueOnce({ ok: true, text }).mockResolvedValueOnce(valid);
    const result = await allocateWithRetry(call, context);
    expect(call).toHaveBeenCalledTimes(2);
    expect(call.mock.calls[1]?.[0]).toContain(error);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload[0]?.buyer_id).toBe("ana");
  });
  it("returns the second validation error without a third attempt", async () => {
    const call = vi.fn().mockResolvedValue({ ok: true, text: "[]" });
    const result = await allocateWithRetry(call, context);
    expect(call).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: false, message: "The AI must assign all 1 tasks exactly once. No tasks were changed." });
  });
  it("does not repeat valid allocations", async () => {
    const call = vi.fn().mockResolvedValue(valid);
    expect((await allocateWithRetry(call, context)).ok).toBe(true);
    expect(call).toHaveBeenCalledTimes(1);
  });
  it("does not retry gateway failures", async () => {
    const call = vi.fn().mockResolvedValue({ ok: false, message: "AI access denied" });
    expect(await allocateWithRetry(call, context)).toEqual({ ok: false, message: "AI access denied" });
    expect(call).toHaveBeenCalledTimes(1);
  });
});
describe("Manager review", () => {
  const taskId = "00000000-0000-4000-8000-000000000001";
  it.each(["reassign", "reject"])("requires at least 10 characters for %s", (action) => {
    expect(reviewSchema.safeParse({ action, taskId, buyerId: taskId, reason: "123456789" }).success).toBe(false);
    expect(reviewSchema.safeParse({ action, taskId, buyerId: taskId, reason: "1234567890" }).success).toBe(true);
  });
  it("does not count AI proposals as approved", () => expect(reviewMetrics([{ status: "proposed" }], []).approved).toBe(0));
  it("estimates 5.5 hours saved per approved task from 6 versus 0.5 hours", () => expect(reviewMetrics([{ status: "approved" }, { status: "approved" }, { status: "proposed" }], []).hoursSaved).toBe(11));
  it("counts each overridden AI proposal once", () => expect(reviewMetrics([], [{ action: "propose", proposal_id: "1" }, { action: "propose", proposal_id: "2" }, { action: "reassign", proposal_id: "1" }, { action: "reject", proposal_id: "1" }]).overrideRate).toBe(50));
  it("reset metrics are zero", () => expect(reviewMetrics([{ status: "pending" }], [])).toEqual({ approved: 0, total: 1, overrideRate: 0, hoursSaved: 0 }));
});