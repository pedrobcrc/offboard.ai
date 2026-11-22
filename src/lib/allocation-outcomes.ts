export type AllocationOutcome = {
  proposal_id: string;
  worked: string | null;
  supplier_term_lost: boolean | null;
  comment: string | null;
  request_sent_at: string | null;
  answered_at: string | null;
};

export function outcomeForProposal(proposalId: string | null, outcomes: AllocationOutcome[]) {
  return proposalId ? outcomes.find((outcome) => outcome.proposal_id === proposalId) : undefined;
}

export function outcomeMetrics(outcomes: AllocationOutcome[]) {
  return {
    sent: outcomes.filter((outcome) => outcome.request_sent_at !== null).length,
    answered: outcomes.filter((outcome) => outcome.answered_at !== null).length,
    termsLost: outcomes.filter((outcome) => outcome.supplier_term_lost === true).length,
  };
}