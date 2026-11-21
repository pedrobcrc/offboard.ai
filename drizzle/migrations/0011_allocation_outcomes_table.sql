CREATE TABLE public.allocation_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL,
  task_id uuid NOT NULL,
  offboarding_id uuid NOT NULL REFERENCES public.offboardings(id),
  due_date date NOT NULL,
  request_sent_at timestamptz,
  worked text,
  supplier_term_lost boolean,
  comment text,
  answered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT allocation_outcomes_proposal_id_key UNIQUE (proposal_id),
  CONSTRAINT allocation_outcomes_worked_check CHECK (worked IN ('yes', 'partly', 'no'))
);

GRANT ALL ON public.allocation_outcomes TO service_role;

ALTER TABLE public.allocation_outcomes ENABLE ROW LEVEL SECURITY;