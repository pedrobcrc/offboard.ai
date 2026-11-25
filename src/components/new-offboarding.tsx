import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Download, FileText, Loader2, Plus, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addOffboardingTasks, createOffboarding, listTeam, uploadDocument } from "@/lib/rag.functions";
import { formatFileSize } from "@/lib/procurement-demo";
import { readUploadFile } from "@/lib/read-upload";
import { TASK_CSV_TEMPLATE, parseTaskCsv, type NewTask } from "@/lib/task-router";
import type { Criticality } from "@/lib/task-router";

const STEPS = ["Who is leaving", "Their files", "Their open tasks"];
const emptyTask = (): NewTask => ({ supplier: "", title: "", dueDate: "", criticality: "Medium" });

export function NewOffboarding({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (open: boolean) => void; onDone: (id: string) => void }) {
  const teamFn = useServerFn(listTeam);
  const createFn = useServerFn(createOffboarding);
  const uploadFn = useServerFn(uploadDocument);
  const addTasksFn = useServerFn(addOffboardingTasks);
  const team = useQuery({ queryKey: ["team-all"], queryFn: () => teamFn(), enabled: open });
  const [step, setStep] = useState(0);
  const [id, setId] = useState<string | null>(null);
  const [mode, setMode] = useState<"member" | "new">("member");
  const [memberId, setMemberId] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [lastDay, setLastDay] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [tasks, setTasks] = useState<NewTask[]>([emptyTask()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const csvInput = useRef<HTMLInputElement>(null);

  function reset() { setStep(0); setId(null); setMode("member"); setMemberId(""); setName(""); setRole(""); setLastDay(""); setFiles([]); setTasks([emptyTask()]); setError(""); }
  function close(next: boolean) { if (busy) return; onOpenChange(next); if (!next) { if (id) onDone(id); reset(); } }

  async function submitWho() {
    setBusy(true); setError("");
    try {
      const result = await createFn({ data: mode === "member" ? { memberId, lastWorkingDay: lastDay } : { name, role, lastWorkingDay: lastDay } });
      if (!result.ok) setError(result.message); else { setId(result.id); setStep(1); }
    } catch { setError("Could not start this offboarding."); } finally { setBusy(false); }
  }
  async function upload(list: FileList | null) {
    if (!id) return;
    setBusy(true); setError("");
    for (const file of Array.from(list ?? [])) {
      const read = await readUploadFile(file);
      if (!read.ok) { setError(read.message); continue; }
      const result = await uploadFn({ data: { filename: file.name, content: read.content, sizeLabel: formatFileSize(file.size), offboardingId: id } });
      if (!result.ok) setError(result.message); else setFiles((current) => [...current, result.document.filename]);
    }
    setBusy(false); if (fileInput.current) fileInput.current.value = "";
  }
  async function importCsv(list: FileList | null) {
    const file = list?.[0]; if (!file) return;
    const parsed = parseTaskCsv(await file.text());
    setError(parsed.errors.join(" "));
    if (parsed.tasks.length) setTasks((current) => [...current.filter((t) => t.supplier || t.title || t.dueDate), ...parsed.tasks]);
    if (csvInput.current) csvInput.current.value = "";
  }
  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([TASK_CSV_TEMPLATE], { type: "text/csv" }));
    const link = document.createElement("a"); link.href = url; link.download = "offboarding-tasks-template.csv"; link.click(); URL.revokeObjectURL(url);
  }
  async function finish() {
    if (!id) return;
    const filled = tasks.filter((t) => t.supplier || t.title || t.dueDate);
    if (!filled.length) { setError("Add at least one open task."); return; }
    setBusy(true); setError("");
    try {
      const result = await addTasksFn({ data: { offboardingId: id, tasks: filled } });
      if (!result.ok) { setError(result.message); return; }
      onDone(id); onOpenChange(false); reset();
    } catch { setError("Check every task has a vendor, task, due date and criticality."); } finally { setBusy(false); }
  }
  const update = (index: number, patch: Partial<NewTask>) => setTasks((current) => current.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  const whoReady = lastDay && (mode === "member" ? memberId : name.trim() && role.trim());

  return <Dialog open={open} onOpenChange={close}><DialogContent className="review-dialog offboarding-dialog">
    <DialogTitle>New offboarding</DialogTitle>
    <DialogDescription>Step {step + 1} of 3 · {STEPS[step]}</DialogDescription>
    <ol className="wizard-steps">{STEPS.map((label, i) => <li key={label} className={i < step ? "done" : i === step ? "current" : ""}><span>{i < step ? <Check size={11} /> : i + 1}</span>{label}</li>)}</ol>
    {step === 0 && <form className="buyer-form" onSubmit={(e) => { e.preventDefault(); if (whoReady) submitWho(); }}>
      <div className="wizard-choice" role="radiogroup" aria-label="Departing person">
        <Button type="button" variant="outline" size="sm" role="radio" aria-checked={mode === "member"} className={mode === "member" ? "active" : ""} onClick={() => setMode("member")}>Existing team member</Button>
        <Button type="button" variant="outline" size="sm" role="radio" aria-checked={mode === "new"} className={mode === "new" ? "active" : ""} onClick={() => setMode("new")}>Add a new person</Button>
      </div>
      {mode === "member" ? <label>Team member<Select value={memberId} onValueChange={setMemberId}><SelectTrigger aria-label="Team member"><SelectValue placeholder="Choose who is leaving" /></SelectTrigger><SelectContent>{(team.data ?? []).map((m) => <SelectItem key={m.id} value={m.id}>{m.name} · {m.expertise}</SelectItem>)}</SelectContent></Select><small className="wizard-note">They will not be proposed for their own tasks.</small></label>
        : <><label>Name<input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></label><label>Role<input value={role} maxLength={80} placeholder="e.g. Category Buyer" onChange={(e) => setRole(e.target.value)} /></label></>}
      <label>Last working day<input type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} /></label>
      {error && <p role="alert" className="ingestion-error">{error}</p>}
      <Button type="submit" disabled={busy || !whoReady}>{busy ? <Loader2 className="animate-spin" /> : <ArrowRight size={14} />}Continue</Button>
    </form>}
    {step === 1 && <div className="buyer-form">
      <div className="drop-zone"><h3>{busy ? "Adding documents…" : "Add their documents"}</h3><Button variant="outline" size="sm" disabled={busy} onClick={() => fileInput.current?.click()}>Browse files</Button><input ref={fileInput} type="file" multiple accept=".txt,.md,.eml,.csv,.pdf" hidden aria-label="Offboarding files" onChange={(e) => upload(e.target.files)} /><p className="file-types">PDF, EML, TXT, MD & CSV</p></div>
      {files.map((f) => <p className="wizard-file" key={f}><FileText size={13} />{f}<Check size={13} className="file-check" /></p>)}
      {error && <p role="alert" className="ingestion-error">{error}</p>}
      <Button disabled={busy} onClick={() => { setError(""); setStep(2); }}><ArrowRight size={14} />{files.length ? "Continue" : "Skip for now"}</Button>
    </div>}
    {step === 2 && <div className="buyer-form">
      <div className="wizard-csv"><Button type="button" variant="outline" size="sm" onClick={() => csvInput.current?.click()}><UploadCloud size={13} />Import CSV</Button><input ref={csvInput} type="file" accept=".csv" hidden aria-label="Tasks CSV" onChange={(e) => importCsv(e.target.files)} /><Button type="button" variant="ghost" size="sm" onClick={downloadTemplate}><Download size={13} />CSV template</Button></div>
      <div className="wizard-tasks">{tasks.map((task, i) => <div className="wizard-task" key={i}>
        <input aria-label={`Vendor ${i + 1}`} placeholder="Vendor" value={task.supplier} onChange={(e) => update(i, { supplier: e.target.value })} />
        <input aria-label={`Task ${i + 1}`} placeholder="Task" value={task.title} onChange={(e) => update(i, { title: e.target.value })} />
        <input aria-label={`Due date ${i + 1}`} type="date" value={task.dueDate} onChange={(e) => update(i, { dueDate: e.target.value })} />
        <Select value={task.criticality} onValueChange={(v) => update(i, { criticality: v as Criticality })}><SelectTrigger aria-label={`Criticality ${i + 1}`}><SelectValue /></SelectTrigger><SelectContent>{["High", "Medium", "Low"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
        <Button type="button" variant="ghost" size="icon" aria-label={`Remove task ${i + 1}`} onClick={() => setTasks((current) => current.filter((_, j) => j !== i))}><Trash2 size={13} /></Button>
      </div>)}</div>
      <Button type="button" variant="outline" size="sm" onClick={() => setTasks((current) => [...current, emptyTask()])}><Plus size={13} />Add task</Button>
      {error && <p role="alert" className="ingestion-error">{error}</p>}
      <Button disabled={busy} onClick={finish}>{busy ? <Loader2 className="animate-spin" /> : <Check size={14} />}Create offboarding</Button>
    </div>}
  </DialogContent></Dialog>;
}
