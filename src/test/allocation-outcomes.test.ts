import { describe, expect, it } from "vitest";
import { outcomeForProposal, outcomeMetrics, type AllocationOutcome } from "@/lib/allocation-outcomes";

const sent: AllocationOutcome = {
  proposal_id: "sent",
  worked: null,
  supplier_term_lost: null,
  comment: null,
  request_sent_at: "2026-11-22T00:47:24Z",
  answered_at: null,
};
const outcomes: AllocationOutcome[] = [
  ...Array.from({ length: 5 }, (_, index) => ({ ...sent, proposal_id: `pending-${index}` })),
  { ...sent, proposal_id: "greenlabel", worked: "yes", supplier_term_lost: false, answered_at: "2026-11-22T00:48:14Z" },
  { ...sent, proposal_id: "chemsol", worked: "no", supplier_term_lost: true, comment: "Volume discount lapsed during handover", answered_at: "2026-11-22T00:48:47Z" },
];

describe("Read-only outcome matching", () => {
  it("matches GreenLabel by proposal id with worked yes", () => {
    expect(outcomeForProposal("greenlabel", outcomes)?.worked).toBe("yes");
  });
  it("matches ChemSol's negative answer, lost term and comment", () => {
    expect(outcomeForProposal("chemsol", outcomes)).toMatchObject({ worked: "no", supplier_term_lost: true, comment: "Volume discount lapsed during handover" });
  });
  it("leaves all five other sent checks unanswered", () => {
    expect(outcomes.filter((outcome) => outcome.request_sent_at && !outcome.answered_at)).toHaveLength(5);
  });
  it("does not match an absent or stale proposal", () => {
    expect(outcomeForProposal(null, outcomes)).toBeUndefined();
    expect(outcomeForProposal("older-proposal", outcomes)).toBeUndefined();
  });
});

describe("Outcome metrics", () => {
  it("counts exactly two answered out of seven sent and one supplier term lost", () => {
    expect(outcomeMetrics(outcomes)).toEqual({ answered: 2, sent: 7, termsLost: 1 });
  });
  it("excludes unsent rows from the sent denominator", () => {
    expect(outcomeMetrics([...outcomes, { ...sent, proposal_id: "unsent", request_sent_at: null }])).toEqual({ answered: 2, sent: 7, termsLost: 1 });
  });
});