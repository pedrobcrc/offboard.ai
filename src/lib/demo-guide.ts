import { projectedWorkload } from "@/lib/task-router";

export type StepState = "done" | "current" | "upcoming";
export const DEMO_STEPS = [
  { id: "files-section", label: "Load the departing buyer's files", hint: "Click Start demo to load Laura's six documents and open tasks." },
  { id: "ask-section", label: "Ask the knowledge base", hint: "Ask a question — try one of these:" },
  { id: "distribute-section", label: "Distribute the open tasks", hint: "Open Task Router and click “Distribute Workload via AI”." },
  { id: "review-section", label: "Manager review", hint: "Approve, reassign or reject each proposal — or click “Approve all remaining”." },
] as const;

type Input = {
  documentCount: number;
  answered: boolean;
  tasks: { status: string }[];
  decisions: { action: string }[];
};
/** Derives each step's completion from workspace data; the first unfinished step is current. */
export function demoProgress({ documentCount, answered, tasks, decisions }: Input) {
  const allocated = decisions.some((d) => d.action === "propose");
  const done = [
    documentCount >= 6,
    answered,
    allocated,
    allocated && tasks.length > 0 && !tasks.some((t) => t.status === "proposed"),
  ];
  const current = done.findIndex((d) => !d);
  const states: StepState[] = done.map((d, i) => (d ? "done" : i === current ? "current" : "upcoming"));
  return { states, current, complete: current === -1 };
}

export function demoSummary(
  team: { id: string; name: string; capacity: number }[],
  tasks: { status: string; criticality: string; assignedMemberId: string | null }[],
  decisions: { action: string; proposal_id: string }[],
) {
  const proposals = new Set(decisions.filter((d) => d.action === "propose").map((d) => d.proposal_id)).size;
  const reassigned = decisions.filter((d) => d.action === "reassign").length;
  const rejected = decisions.filter((d) => d.action === "reject").length;
  const overrides = reassigned + rejected;
  return {
    reassigned, rejected, overrides,
    overrideRate: proposals ? Math.round((overrides / proposals) * 100) : 0,
    loads: team.map((p) => ({ name: p.name, before: p.capacity, after: projectedWorkload(p.capacity, tasks.filter((t) => t.status === "approved" && t.assignedMemberId === p.id)) })),
  };
}
