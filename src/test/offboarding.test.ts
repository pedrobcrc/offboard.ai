import { describe, expect, it } from "vitest";
import { TASK_CSV_TEMPLATE, allocationSystemPrompt, parseTaskCsv } from "@/lib/task-router";

describe("Offboarding task CSV", () => {
  it("parses vendor, task, due_date and criticality rows", () => {
    const { tasks, errors } = parseTaskCsv('vendor,task,due_date,criticality\nNordSteel,"Send forecast, 2027",2026-12-05,high\nAMCOR,Renew,2026-12-15,Low\n');
    expect(errors).toEqual([]);
    expect(tasks).toEqual([
      { supplier: "NordSteel", title: "Send forecast, 2027", dueDate: "2026-12-05", criticality: "High" },
      { supplier: "AMCOR", title: "Renew", dueDate: "2026-12-15", criticality: "Low" },
    ]);
  });
  it("rejects criticality outside High/Medium/Low", () => expect(parseTaskCsv("vendor,task,due_date,criticality\nX,Y,2026-12-01,Urgent").tasks).toEqual([]));
  it("requires all four columns", () => expect(parseTaskCsv("vendor,task\nX,Y").errors.length).toBe(1));
  it("accepts its own template", () => expect(parseTaskCsv(TASK_CSV_TEMPLATE).tasks.length).toBe(1));
});

describe("Allocation prompt", () => {
  it("names the active departing person instead of Laura", () => {
    const prompt = allocationSystemPrompt({ departingName: "David", departingRole: "Logistics expert", lastWorkingDay: "2026-12-31" }, ["handover.txt"]);
    expect(prompt).toContain("David (Logistics expert) is leaving on 2026-12-31");
    expect(prompt).not.toContain("Laura");
    expect(prompt).toContain("Never exceed 100% projected workload");
  });
});
