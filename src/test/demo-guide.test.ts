import { describe, expect, it } from "vitest";
import { demoProgress, demoSummary } from "@/lib/demo-guide";

describe("guided demo progress", () => {
  it("starts at asking once six documents are loaded", () => {
    expect(demoProgress({ documentCount: 6, answered: false, tasks: [{ status: "pending" }], decisions: [] }).current).toBe(1);
  });
  it("is not complete while any proposal awaits review", () => {
    const p = demoProgress({ documentCount: 6, answered: true, tasks: [{ status: "approved" }, { status: "proposed" }], decisions: [{ action: "propose" }] });
    expect(p.current).toBe(3);
  });
  it("completes when allocations exist and none remain proposed", () => {
    expect(demoProgress({ documentCount: 6, answered: true, tasks: [{ status: "approved" }, { status: "pending" }], decisions: [{ action: "propose" }, { action: "reject" }] }).complete).toBe(true);
  });
  it("counts overrides and approved workload after review", () => {
    const s = demoSummary([{ id: "a", name: "Ana", capacity: 40 }], [{ status: "approved", criticality: "High", assignedMemberId: "a" }],
      [{ action: "propose", proposal_id: "1" }, { action: "propose", proposal_id: "2" }, { action: "reassign", proposal_id: "1" }]);
    expect(s.overrideRate).toBe(50);
    expect(s.loads[0]).toEqual({ name: "Ana", before: 40, after: 50 });
  });
});
