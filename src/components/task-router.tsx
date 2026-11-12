import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, FileText, GitBranch, Loader2, Pencil, Save, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { distributeWorkload, getDocumentText, updateBuyer, type TeamRow, type Workspace } from "@/lib/rag.functions";
import { isWorkloadWarning, projectedWorkload } from "@/lib/task-router";

function dueLabel(date: string | null) {
  return date ? new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "—";
}
export function TaskRouter({ workspace }: { workspace: Workspace }) {
  const queryClient = useQueryClient();
  const distribute = useServerFn(distributeWorkload);
  const saveBuyer = useServerFn(updateBuyer);
  const readDocument = useServerFn(getDocumentText);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<TeamRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [source, setSource] = useState<{ filename: string; content: string } | null>(null);
  const pending = workspace.tasks.filter((task) => task.status === "pending");
  const assigned = workspace.tasks.filter((task) => task.status === "assigned");
  async function allocate() {
    setBusy(true); setError("");
    try {
      const result = await distribute();
      if (!result.ok) setError(result.message);
      else await queryClient.invalidateQueries({ queryKey: ["workspace"] });
    } catch { setError("Could not distribute tasks. Please try again."); }
    finally { setBusy(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!editing) return;
    setSaving(true); setEditError("");
    try {
      const result = await saveBuyer({ data: { id: editing.id, name: editing.name, expertise: editing.expertise, capacity: editing.capacity } });
      if (!result.ok) setEditError(result.message);
      else { await queryClient.invalidateQueries({ queryKey: ["workspace"] }); setEditing(null); }
    } catch { setEditError("Could not save this buyer."); }
    finally { setSaving(false); }
  }
  async function openSource(filename: string) {
    setSource({ filename, content: "Loading document…" });
    try {
      const result = await readDocument({ data: { filename } });
      setSource((current) => current?.filename === filename ? { filename, content: result.ok ? result.document.content : result.message } : current);
    } catch { setSource((current) => current?.filename === filename ? { filename, content: "Could not open this document." } : current); }
  }
  return <section className="fade-in" role="tabpanel" id="tasks-panel" aria-labelledby="tasks-tab">
    <div className="task-grid">
      <div className="panel"><div className="panel-head"><div><h2 className="panel-title"><GitBranch />Departing Buyer's Pending Tasks</h2><p className="panel-subtitle">{workspace.departingBuyer?.name} · Supplier priorities</p></div><span className="count-badge">{pending.length} tasks</span></div>
        <div className="task-body">{pending.length ? pending.map((task, index) => <div className="pending-task" key={task.id}><span className="task-number">{String(index + 1).padStart(2, "0")}</span><div className="task-detail"><strong>{task.title}</strong><p>{task.supplier}<span>Due {dueLabel(task.dueDate)}</span></p></div><span className={`priority priority-${task.criticality.toLowerCase()}`}>{task.criticality}</span></div>) : <div className="pending-task">Every pending task has an owner.</div>}</div>
      </div>
      <div className="panel"><div className="panel-head"><div><h2 className="panel-title"><Users />Remaining Team Capacity</h2><p className="panel-subtitle">{assigned.length ? "Current → projected workload" : "Expertise and current workload"}</p></div><span className="count-badge">{workspace.team.length} buyers</span></div>
        <div className="task-body">{workspace.team.map((person) => {
          const load = projectedWorkload(person.capacity, assigned.filter((task) => task.assignedMemberId === person.id));
          const warning = isWorkloadWarning(load);
          return <div className="team-row" key={person.id}><div className="team-info"><span className={`avatar ${person.tone}`}>{person.initials}</span><div className="buyer-detail"><strong>{person.name}</strong><p>{person.expertise}</p></div><span className={`workload ${warning ? "amber" : "blue"}`}>{load !== person.capacity ? `${person.capacity}% → ` : ""}{load}%</span><Button variant="ghost" size="icon" aria-label={`Edit ${person.name}`} title={`Edit ${person.name}`} disabled={busy} onClick={() => { setEditError(""); setEditing({ ...person }); }}><Pencil size={13} /></Button></div><div className="capacity-track" role="progressbar" aria-label={`${person.name}'s workload`} aria-valuenow={load} aria-valuemin={0} aria-valuemax={100}><span className={`capacity-fill ${warning ? "amber" : "blue"}`} style={{ width: `${Math.min(100, load)}%` }} /></div></div>;
        })}</div>
      </div>
    </div>
    <div className="allocation-action"><p>Expertise-led decisions. Capacity-aware assignments.</p><Button onClick={allocate} disabled={busy || !pending.length}>{busy ? <Loader2 className="animate-spin" /> : <Sparkles size={16} />}{busy ? "Matching tasks to your team…" : "Distribute Workload via AI"}{!busy && <ArrowRight size={15} />}</Button></div>
    {error && <p role="alert" className="ingestion-error">{error}</p>}
    <div className="panel" aria-live="polite"><div className="panel-head"><div><h2 className="panel-title"><GitBranch />Workload allocation</h2><p className="panel-subtitle">A clear owner for every next step</p></div><span className="count-badge">{assigned.length ? `${assigned.length} tasks assigned` : "Awaiting allocation"}</span></div>
      {assigned.length ? <div className="table-wrap"><table className="allocation-table"><thead><tr>{["Task", "Criticality", "Assigned buyer", "Rationale", "Confidence", "Source"].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{assigned.map((task) => {
        const buyer = workspace.team.find((person) => person.id === task.assignedMemberId);
        return <tr key={task.id}><td>{task.title}<p className="task-due">{task.supplier} · Due {dueLabel(task.dueDate)}</p></td><td><span className={`priority priority-${task.criticality.toLowerCase()}`}>{task.criticality}</span></td><td><span className="assignee"><span className={`avatar ${buyer?.tone ?? "blue"}`}>{buyer?.initials ?? task.assignedInitials}</span>{buyer?.name ?? task.assignedBuyer}</span></td><td>{task.rationale}</td><td><span className={`priority priority-${task.confidence?.toLowerCase() ?? "low"}`}>{task.confidence ?? "—"}</span></td><td>{task.sourceFile ? <Button variant="outline" size="sm" className="source-chip" onClick={() => openSource(task.sourceFile ?? "")}><FileText size={11} />{task.sourceFile}</Button> : <span>No supporting source</span>}</td></tr>;
      })}</tbody></table></div> : <div className="allocation-empty"><div className="upload-icon"><GitBranch size={21} /></div><h3>Ready for the next chapter</h3><p>Your team's next assignments will appear here.</p></div>}
    </div>
    <Sheet open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}><SheetContent className="router-sheet"><SheetTitle>Edit buyer</SheetTitle><SheetDescription>Buyer expertise and current workload</SheetDescription>{editing && <form className="buyer-form" onSubmit={save}><label>Name<input required maxLength={80} value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label><label>Expertise<input required maxLength={160} value={editing.expertise} onChange={(event) => setEditing({ ...editing, expertise: event.target.value })} /></label><label>Current workload (%)<input type="number" min={0} max={100} required value={editing.capacity} onChange={(event) => setEditing({ ...editing, capacity: Number(event.target.value) })} /></label>{editError && <p className="ingestion-error" role="alert">{editError}</p>}<Button type="submit" disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save size={15} />}Save buyer</Button></form>}</SheetContent></Sheet>
    <Sheet open={!!source} onOpenChange={(open) => { if (!open) setSource(null); }}><SheetContent className="router-sheet document-sheet"><SheetTitle>{source?.filename}</SheetTitle><SheetDescription>Cited procurement document</SheetDescription><pre className="document-text">{source?.content}</pre></SheetContent></Sheet>
  </section>;
}