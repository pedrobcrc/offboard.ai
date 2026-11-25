import { Check, Loader2, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEMO_STEPS, demoSummary, type StepState } from "@/lib/demo-guide";
import { SUGGESTED_QUESTIONS } from "@/lib/procurement-demo";
import { loadTone } from "@/components/task-router";
import type { Workspace } from "@/lib/rag.functions";

type Props = {
  workspace: Workspace;
  states: StepState[];
  current: number;
  complete: boolean;
  starting: boolean;
  error: string;
  onStart: () => void;
  onStep: (index: number) => void;
  onAsk: (question: string) => void;
};

export function DemoGuide({ workspace, states, current, complete, starting, error, onStart, onStep, onAsk }: Props) {
  const summary = complete ? demoSummary(workspace.team, workspace.tasks, workspace.decisions) : null;
  return <section className="demo-guide" aria-label="Guided demo">
    <div className="demo-guide-row">
      <ol className="demo-steps">{DEMO_STEPS.map((step, i) => <li key={step.id}>
        <Button variant="ghost" className={`demo-step ${states[i]}`} aria-current={states[i] === "current" ? "step" : undefined} onClick={() => onStep(i)}>
          <span className="demo-step-dot">{states[i] === "done" ? <Check size={12} /> : i + 1}</span>
          <span className="demo-step-text">{step.label}<span className="sr-only"> — {states[i] === "done" ? "Done" : states[i] === "current" ? "Current" : "Upcoming"}</span></span>
        </Button>
      </li>)}</ol>
      <Button onClick={onStart} disabled={starting} className="demo-start">{starting ? <Loader2 className="animate-spin" /> : complete ? <RotateCcw size={14} /> : <Play size={14} />}{complete ? "Restart demo" : "Start demo"}</Button>
    </div>
    {!complete && <div className="demo-hint"><strong>Step {current + 1}.</strong> {DEMO_STEPS[current]?.hint}
      {current === 1 && SUGGESTED_QUESTIONS.map((q) => <Button key={q} variant="outline" size="sm" className="demo-question" onClick={() => onAsk(q)}>{q}</Button>)}
    </div>}
    {error && <p role="alert" className="ingestion-error">{error}</p>}
    {summary && <div className="demo-summary">
      <p className="demo-summary-title">Handover complete — every AI proposal has a manager decision.</p>
      <p>Tasks reassigned <strong>{summary.reassigned}</strong><span className="mx-2">·</span>Manager overrides <strong>{summary.overrides}</strong> ({summary.overrideRate}% override rate, {summary.rejected} rejected)</p>
      <div className="demo-loads">{summary.loads.map((l) => <span key={l.name}>{l.name} <strong>{l.before}% → <span className={`load-${loadTone(l.after)}`}>{l.after}%</span></strong></span>)}</div>
    </div>}
  </section>;
}
