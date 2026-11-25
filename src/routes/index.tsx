import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NewOffboarding } from "@/components/new-offboarding";
import { readUploadFile } from "@/lib/read-upload";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertCircle, ArrowUp, FileSpreadsheet, FileText, Loader2, Mail, Moon, Network, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskRouter } from "@/components/task-router";
import { DemoGuide } from "@/components/demo-guide";
import { DEMO_STEPS, demoProgress } from "@/lib/demo-guide";
import { Switch } from "@/components/ui/switch";
import { answerSources } from "@/lib/answer-sources";
import { SAMPLE_OFFBOARDING_ID, askAssistant, getWorkspace, listOffboardings, resetTaskDemo, uploadDocument, type OffboardingRow } from "@/lib/rag.functions";
import { CACHED_ANSWERS, CACHED_LABEL, SUGGESTED_QUESTIONS, formatFileSize } from "@/lib/procurement-demo";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Offboard.AI — Procurement Continuity Engine" },
    { name: "description", content: "Preserve supplier knowledge and confidently distribute procurement work with Offboard.AI." },
    { property: "og:title", content: "Offboard.AI — Procurement Continuity Engine" },
    { property: "og:description", content: "A connected workspace for procurement knowledge and team continuity." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(workspaceQueryOptions),
  component: Dashboard,
});

export const workspaceQuery = (offboardingId: string) => queryOptions({
  queryKey: ["workspace", offboardingId],
  queryFn: () => getWorkspace({ data: { offboardingId } }),
});
const workspaceQueryOptions = workspaceQuery(SAMPLE_OFFBOARDING_ID);
const offboardingsQuery = queryOptions({ queryKey: ["offboardings"], queryFn: () => listOffboardings() });
const STATUS_LABEL: Record<OffboardingRow["status"], string> = { draft: "Draft", in_review: "In review", completed: "Completed" };

type View = "knowledge" | "tasks";
type Source = { filename: string; excerpt: string };
type Message = {
  role: "user" | "assistant";
  text: string;
  sources?: Source[];
  cached?: boolean;
  failed?: boolean;
};

function Dashboard() {
  const { data: sampleWorkspace } = useSuspenseQuery(workspaceQueryOptions);
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState(SAMPLE_OFFBOARDING_ID);
  useEffect(() => { try { const saved = window.localStorage.getItem("offboarding"); if (saved) setActiveId(saved); } catch { /* sample */ } }, []);
  const active = useQuery({ ...workspaceQuery(activeId), placeholderData: keepPreviousData });
  useEffect(() => { if (active.isError && activeId !== SAMPLE_OFFBOARDING_ID) selectOffboarding(SAMPLE_OFFBOARDING_ID); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.isError]);
  const workspace = active.data ?? sampleWorkspace;
  const offboardings = useQuery(offboardingsQuery);
  const isSample = workspace.offboarding.isSample;
  const readOnly = workspace.offboarding.status === "completed";
  const [wizardOpen, setWizardOpen] = useState(false);
  function selectOffboarding(id: string) {
    setActiveId(id); setMessages([]); setInput(""); setExpanded(null); setUploadError("");
    try { window.localStorage.setItem("offboarding", id); } catch { /* storage unavailable */ }
  }
  const [view, setView] = useState<View>("knowledge");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    try { if (window.localStorage.getItem("theme") === "light") setTheme("light"); } catch { /* keep dark */ }
  }, []);
  useEffect(() => { document.documentElement.classList.toggle("light", theme === "light"); }, [theme]);
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try { window.localStorage.setItem("theme", next); } catch { /* storage unavailable */ }
  }
  const [guidedDemo, setGuidedDemo] = useState(false);
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("demo") === "1") { setGuidedDemo(true); return; }
      setGuidedDemo(window.localStorage.getItem("guided-demo") === "1");
    } catch { /* keep default off */ }
  }, []);
  function toggleGuidedDemo(on: boolean) {
    setGuidedDemo(on);
    try { window.localStorage.setItem("guided-demo", on ? "1" : "0"); } catch { /* storage unavailable */ }
  }
  const [expanded, setExpanded] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const history = useRef<HTMLDivElement>(null);

  const askFn = useServerFn(askAssistant);
  const resetFn = useServerFn(resetTaskDemo);
  const refreshFn = useServerFn(getWorkspace);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const progress = demoProgress({ documentCount: workspace.documents.length, answered: messages.some((m) => m.role === "assistant" && !m.failed), tasks: workspace.tasks, decisions: workspace.decisions });
  const autoAdvanced = useRef(false);
  useEffect(() => {
    if (!guidedDemo || !isSample || autoAdvanced.current || progress.states[1] !== "done") return;
    autoAdvanced.current = true;
    const timer = setTimeout(() => goToStep(2), 2500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.states[1], guidedDemo]);
  function goToStep(index: number) {
    setView(index < 2 ? "knowledge" : "tasks");
    setTimeout(() => document.getElementById(DEMO_STEPS[index]?.id ?? "")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }
  async function startDemo() {
    setStarting(true); setStartError("");
    try {
      const result = await resetFn();
      if (!result.ok) { setStartError(result.message ?? "Could not start the demo."); return; }
      queryClient.setQueryData(["workspace", SAMPLE_OFFBOARDING_ID], await refreshFn({ data: { offboardingId: SAMPLE_OFFBOARDING_ID } }));
      setMessages([]); setInput("");
      autoAdvanced.current = false;
      goToStep(1);
    } catch { setStartError("Could not start the demo. Please try again."); }
    finally { setStarting(false); }
  }
  const uploadFn = useServerFn(uploadDocument);

  useEffect(() => { if (messages.length || thinking) history.current?.scrollTo({ top: history.current.scrollHeight, behavior: "smooth" }); }, [messages, thinking]);

  async function ask(question: string) {
    const questionText = question.trim();
    if (!questionText || thinking) return;
    setMessages((current) => [...current, { role: "user", text: questionText }]);
    setInput(""); setThinking(true); setExpanded(null);
    let result: Awaited<ReturnType<typeof askFn>>;
    try {
      result = await askFn({ data: { question: questionText, offboardingId: workspace.offboarding.id } });
    } catch {
      result = { ok: false, message: "Could not reach the assistant. Check your connection and try again." };
    }
    if (result.ok) {
      setMessages((current) => [...current, { role: "assistant", text: result.answer, sources: result.sources }]);
    } else if (guidedDemo && isSample && CACHED_ANSWERS[questionText]) {
      const cached = CACHED_ANSWERS[questionText];
      setMessages((current) => [...current, { role: "assistant", text: cached.answer, cached: true, sources: cached.sources.map((filename) => ({ filename, excerpt: "" })) }]);
    } else {
      setMessages((current) => [...current, { role: "assistant", text: result.message, failed: true }]);
    }
    setThinking(false);
  }

  async function upload(selected: FileList | null) {
    const files = Array.from(selected ?? []);
    if (!files.length) return;
    setUploading(true); setUploadError("");
    for (const file of files) {
      const read = await readUploadFile(file);
      if (!read.ok) { setUploadError(read.message); continue; }
      const result = await uploadFn({ data: { filename: file.name, content: read.content, sizeLabel: formatFileSize(file.size), offboardingId: workspace.offboarding.id } });
      if (!result.ok) setUploadError(result.message);
    }
    await queryClient.invalidateQueries({ queryKey: ["workspace"] });
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  const tabs = [{ id: "knowledge" as const, label: "Knowledge Retriever" }, { id: "tasks" as const, label: "Task Router" }];
  const lastDay = new Date(`${workspace.offboarding.lastWorkingDay}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const headerStatus = readOnly ? "Completed · read-only" : isSample ? "Sample case" : STATUS_LABEL[workspace.offboarding.status];
  return <div className="app-shell">
    <div className="main-shell"><header className="topbar"><div className="topbar-inner"><div className="brand"><span className="brand-icon"><Network size={18} strokeWidth={1.8} /></span><span>Offboard<span className="brand-ai">.AI</span></span></div><div className="topbar-right">{isSample && <label className="demo-mode" htmlFor="guided-demo-switch"><span>Guided demo</span><Switch id="guided-demo-switch" checked={guidedDemo} onCheckedChange={toggleGuidedDemo} /></label>}<Button variant="ghost" size="icon" className="theme-toggle" onClick={toggleTheme} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} title={theme === "dark" ? "Light theme" : "Dark theme"}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</Button><span className="avatar" role="img" aria-label="Alex Carter, Procurement Manager" title="Alex Carter, Procurement Manager">AC</span></div></div></header>
      <main className="main-content"><div className="page-header"><div className="page-header-left"><h1 className="sr-only">{workspace.offboarding.departingName} offboarding</h1><Select value={workspace.offboarding.id} onValueChange={selectOffboarding}><SelectTrigger aria-label="Active offboarding" title="Switch offboarding" className="offboarding-trigger"><SelectValue>{workspace.offboarding.departingName}</SelectValue></SelectTrigger><SelectContent>{(offboardings.data ?? [workspace.offboarding]).map((o) => <SelectItem key={o.id} value={o.id}>{o.departingName} · {o.departingRole}{o.isSample ? " · Sample" : ` · ${STATUS_LABEL[o.status]}`}</SelectItem>)}</SelectContent></Select><p className="page-header-meta">{workspace.offboarding.departingRole} · last day {lastDay} · {headerStatus}</p></div><Button variant="outline" size="sm" className="new-offboarding" onClick={() => setWizardOpen(true)}>New offboarding</Button></div>
        {guidedDemo && isSample && <DemoGuide workspace={workspace} {...progress} starting={starting} error={startError} onStart={startDemo} onStep={goToStep} onAsk={(q) => { goToStep(1); setInput(q); ask(q); }} />}
        <div className="view-tabs" role="tablist" aria-label="Workspace views">{tabs.map(({ id, label }) => <Button key={id} role="tab" aria-selected={view === id} aria-controls={`${id}-panel`} id={`${id}-tab`} variant="ghost" className={`tab-button ${view === id ? "active" : ""}`} onClick={() => setView(id)}>{label}</Button>)}</div>
        {view === "knowledge" ? <section className="retriever-grid fade-in" role="tabpanel" id="knowledge-panel" aria-labelledby="knowledge-tab">
          <div className="panel chat-panel" id="ask-section">
            <div className="panel-head"><h2 className="panel-title">Ask about the handover</h2></div>
            <div ref={history} className="chat-history" aria-live="polite">
              {messages.length === 0 && <div className="chat-empty"><div className="chat-name">Offboard AI</div><p>{workspace.documents.length > 0 ? `${workspace.offboarding.departingName}'s documents are ready. What would you like to know about their suppliers, contracts, or spend?` : `Add ${workspace.offboarding.departingName}'s documents to start asking questions.`}</p>{isSample && !guidedDemo && <div className="suggestions">{SUGGESTED_QUESTIONS.map((question) => <Button key={question} variant="ghost" className="suggestion-row" onClick={() => ask(question)}>{question}</Button>)}</div>}</div>}
              {messages.map((message, index) => <div key={index} className={`chat-message fade-in ${message.role}`}>{message.role === "assistant" ? <div className="min-w-0"><div className="chat-name">Offboard AI{message.cached && <span className="cached-tag">{CACHED_LABEL}</span>}</div>{message.failed ? <div role="alert" className="answer-failed"><AlertCircle size={16} aria-hidden="true" className="shrink-0" /><div><strong>Answer unavailable</strong><p>{message.text}</p></div></div> : <div className="assistant-answer">{message.text}{message.sources && message.sources.length > 0 && <div className="source-chips">{answerSources(message.text, message.sources).map((source) => { const key = `${index}:${source.filename}`; const open = expanded === key; return <span key={source.filename} className="source-chip-wrap"><Button type="button" variant="outline" size="sm" className={`source-chip ${open ? "open" : ""}`} disabled={!source.excerpt} onClick={() => setExpanded(open ? null : key)}><FileText size={11} />{source.filename}</Button>{open && source.excerpt && <span className="source-excerpt">{source.excerpt}</span>}</span>; })}</div>}</div>}</div> : <div className="user-bubble">{message.text}</div>}</div>)}
              {thinking && <div className="chat-message"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" />Retrieving contract details…</div></div>}
            </div>
            <div className="chat-composer"><form className="composer-form" onSubmit={(event: FormEvent) => { event.preventDefault(); ask(input); }}><input aria-label="Ask your procurement assistant" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about your procurement knowledge…" disabled={thinking} /><Button type="submit" size="icon" aria-label="Send message" disabled={!input.trim() || thinking} className="h-8 w-8">{thinking ? <Loader2 className="animate-spin" /> : <ArrowUp size={16} />}</Button></form><p className="composer-note">Answers cite the file they came from</p></div>
          </div>
          <div className={`panel files-panel ${dragging ? "dragging" : ""}`} id="files-section" onDragOver={(event) => { if (readOnly) return; event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { if (readOnly) return; event.preventDefault(); setDragging(false); upload(event.dataTransfer.files); }}>
            <div className="panel-head"><div className="flex items-center gap-2"><h2 className="panel-title">Documents</h2><span className="count-badge">{workspace.documents.length}</span></div>{!readOnly && <Button variant="outline" size="sm" className="text-xs" disabled={uploading} onClick={() => fileInput.current?.click()}>{uploading ? <><Loader2 className="animate-spin" size={13} />Adding…</> : "Add files"}</Button>}</div>
            <div className="ingestion-body">{!readOnly && <><p className="drop-hint">{uploading ? "Adding your documents…" : "Drop files here. PDF, EML, TXT, MD or CSV."}</p><input ref={fileInput} type="file" multiple accept=".txt,.md,.eml,.csv,.pdf" hidden onChange={(event) => upload(event.target.files)} />{uploadError && <p role="alert" className="ingestion-error">{uploadError}</p>}</>}<div>{workspace.documents.length === 0 && <p className="file-types">No files yet for this offboarding.</p>}{workspace.documents.map((file) => <div className="file-row fade-in" key={file.id}><span className="file-icon">{file.kind === "EML" ? <Mail size={16} /> : file.kind === "XLSX" ? <FileSpreadsheet size={16} /> : <FileText size={16} />}</span><div className="file-info"><strong>{file.filename}</strong><p>{file.detail} · {file.sizeLabel}</p></div></div>)}</div></div>
          </div>
        </section> : <TaskRouter workspace={workspace} readOnly={readOnly} />}
      </main></div>
    <NewOffboarding open={wizardOpen} onOpenChange={setWizardOpen} onDone={async (id) => { await queryClient.invalidateQueries({ queryKey: ["offboardings"] }); selectOffboarding(id); setView("knowledge"); }} />
  </div>;
}
