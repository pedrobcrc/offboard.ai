import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NewOffboarding } from "@/components/new-offboarding";
import { readUploadFile } from "@/lib/read-upload";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, ArrowRight, ArrowUp, ArrowUpRight, Bell, BookOpen, CheckCheck, ChevronRight, CircleCheck, Clock3, FileSpreadsheet, FileText, GitBranch, Layers3, Loader2, LockKeyhole, Mail, Moon, MoreHorizontal, Network, ShieldCheck, Sparkles, Sun, UploadCloud, Users } from "lucide-react";
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
  const [switcherOpen, setSwitcherOpen] = useState(false);
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
  const [sidebarPeeking, setSidebarPeeking] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const history = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  function peek(on: boolean) {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    if (on) setSidebarPeeking(true);
    else closeTimer.current = setTimeout(() => setSidebarPeeking(false), 180);
  }
  useEffect(() => { if (messages.length || thinking) history.current?.scrollTo({ top: history.current.scrollHeight, behavior: "smooth" }); }, [messages, thinking]);

  async function ask(question: string) {
    const questionText = question.trim();
    if (!questionText || thinking) return;
    setMessages((current) => [...current, { role: "user", text: questionText }]);
    setInput(""); setThinking(true); setExpanded(null);
    const result = await askFn({ data: { question: questionText, offboardingId: workspace.offboarding.id } });
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

  const tabs = [{ id: "knowledge" as const, label: "Knowledge Retriever", icon: BookOpen }, { id: "tasks" as const, label: "Task Router", icon: GitBranch }];
  return <div className="app-shell">
    <div className="sidebar-hover-zone" aria-hidden="true" onMouseEnter={() => peek(true)} />
    <aside className={`sidebar ${sidebarPeeking || switcherOpen ? "peeking" : ""}`} onMouseLeave={() => peek(false)} onFocusCapture={() => peek(true)} onKeyDown={(event) => { if (event.key === "Escape") peek(false); }}>
      <div><div className="brand"><span className="brand-icon"><Network size={23} strokeWidth={1.8} /></span><span>Offboard<span className="brand-ai">.AI</span></span></div><p className="brand-subtitle">Procurement continuity engine</p></div>
      <div className="offboarding-switcher"><p className="nav-label">OFFBOARDING</p><Select value={workspace.offboarding.id} onValueChange={selectOffboarding} onOpenChange={setSwitcherOpen}><SelectTrigger aria-label="Active offboarding" className="offboarding-trigger"><SelectValue>{workspace.offboarding.departingName} · {workspace.offboarding.departingRole}</SelectValue></SelectTrigger><SelectContent>{(offboardings.data ?? [workspace.offboarding]).map((o) => <SelectItem key={o.id} value={o.id}>{o.departingName} · {o.departingRole}{o.isSample ? " · Sample" : ` · ${STATUS_LABEL[o.status]}`}</SelectItem>)}</SelectContent></Select><Button variant="outline" size="sm" className="new-offboarding" onClick={() => setWizardOpen(true)}><Plus size={13} />New offboarding</Button></div>
      <nav aria-label="Main navigation"><p className="nav-label">WORKSPACE</p>{tabs.map(({ id, label, icon: Icon }) => <Button key={id} variant="ghost" className={`nav-button ${view === id ? "active" : ""}`} onClick={() => setView(id)} aria-current={view === id ? "page" : undefined}><Icon size={18} />{label}{view === id && <ChevronRight className="ml-auto" size={14} />}</Button>)}</nav>
      <div className="sidebar-bottom"><div className="workspace-box"><div className="flex items-center gap-2"><span className="status-dot" /><strong className="text-sm">Continuity workspace</strong></div><p>Your knowledge stays.<br />Your business moves forward.</p><div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck size={12} /> Private demo environment</div></div><div className="profile"><span className="avatar">AC</span><div><strong>Alex Carter</strong><p>Procurement Manager</p></div><span className="ml-auto text-muted-foreground"><MoreHorizontal size={16} /></span></div></div>
    </aside>
    <div className="main-shell" onMouseEnter={() => peek(false)}><header className="topbar"><div className="breadcrumb"><Layers3 size={15} /><span>Workspace</span><ChevronRight size={12} /><strong>{view === "knowledge" ? "Knowledge Retriever" : "Task Router"}</strong></div><div className="topbar-right">{isSample && <label className="demo-mode" htmlFor="guided-demo-switch"><span>Guided demo</span><Switch id="guided-demo-switch" checked={guidedDemo} onCheckedChange={toggleGuidedDemo} /></label>}<Button variant="ghost" size="icon" className="theme-toggle" onClick={toggleTheme} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} title={theme === "dark" ? "Light theme" : "Dark theme"}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</Button><span className="online"><span className="status-dot" /> {isSample ? "Workspace active" : STATUS_LABEL[workspace.offboarding.status]}</span>{isSample && <span className="demo-tag">DEMO</span>}<span className="text-muted-foreground" title="No new notifications"><Bell size={17} /></span><span className="avatar">AC</span></div></header>
      <main className="main-content"><div className="page-title-row"><div><p className="eyebrow"><Sparkles size={12} /> Procurement intelligence</p><h1>{view === "knowledge" ? "Knowledge Retriever" : "Task Router"}</h1><p className="page-subtitle">{view === "knowledge" ? "Keep the knowledge. Maintain the momentum." : "The right work. The right people. A seamless handover."}</p></div><div className="security-badge"><ShieldCheck size={15} /> Procurement continuity, by design</div></div>
        <p className="status-strip" aria-label="Workspace overview"><span>Offboarding <strong>{workspace.offboarding.departingName}</strong> · {workspace.offboarding.departingRole} · last day {new Date(`${workspace.offboarding.lastWorkingDay}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</span><span aria-hidden="true">·</span><span><strong>{workspace.documents.length}</strong> documents indexed</span><span aria-hidden="true">·</span><span><strong>{workspace.team.length}</strong> buyers on the team</span><span aria-hidden="true">·</span><span className="status-ok"><span className="status-dot" /> {readOnly ? "Completed · read-only" : "Knowledge base up to date"}</span></p>
        {guidedDemo && isSample && <DemoGuide workspace={workspace} {...progress} starting={starting} error={startError} onStart={startDemo} onStep={goToStep} onAsk={(q) => { goToStep(1); setInput(q); ask(q); }} />}
        <div className="view-tabs" role="tablist" aria-label="Workspace views">{tabs.map(({ id, label, icon: Icon }) => <Button key={id} role="tab" aria-selected={view === id} aria-controls={`${id}-panel`} id={`${id}-tab`} variant="ghost" className={`tab-button ${view === id ? "active" : ""}`} onClick={() => setView(id)}><Icon size={15} />{label}</Button>)}</div>
        {view === "knowledge" ? <section className="retriever-grid fade-in" role="tabpanel" id="knowledge-panel" aria-labelledby="knowledge-tab">
          <div className="panel" id="files-section"><PanelHead icon={FileText} title="Knowledge sources" subtitle="Your procurement source of truth" badge={String(workspace.documents.length)} /><div className="ingestion-body">{!readOnly && <><div className={`drop-zone ${dragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); upload(event.dataTransfer.files); }}><div className="upload-icon">{uploading ? <Loader2 className="animate-spin" size={22} /> : <UploadCloud size={23} strokeWidth={1.6} />}</div><h3>{uploading ? "Adding your documents…" : "Drop your documents here"}</h3><p>Keep every detail within reach.</p><Button variant="outline" size="sm" className="text-xs" disabled={uploading} onClick={() => fileInput.current?.click()}><ArrowUpRight size={12} />Browse files</Button><input ref={fileInput} type="file" multiple accept=".txt,.md,.eml,.csv,.pdf" hidden onChange={(event) => upload(event.target.files)} /><p className="file-types">PDF, EML, TXT, MD & CSV</p></div>{uploadError && <p className="ingestion-error">{uploadError}</p>}</>}<div className="indexed-heading"><span>Successfully Indexed Files</span><span className="count-badge">{workspace.documents.length} files</span></div><div>{workspace.documents.length === 0 && <p className="file-types">No files yet for this offboarding.</p>}{workspace.documents.map((file) => <div className="file-row fade-in" key={file.id}><span className={`file-icon ${file.kind.toLowerCase()}`}>{file.kind === "EML" ? <Mail size={17} /> : file.kind === "XLSX" ? <FileSpreadsheet size={17} /> : <FileText size={17} />}</span><div className="file-info"><strong>{file.filename}</strong><p>{file.sizeLabel} <span className="mx-1">·</span> {file.detail}</p></div><CircleCheck className="file-check" size={14} /></div>)}</div></div><div className="ingestion-note"><LockKeyhole size={12} /> Documents are stored and searched in your workspace</div></div>
          <div className="panel chat-panel" id="ask-section"><PanelHead icon={Sparkles} title="Procurement assistant" subtitle="Answers grounded in your documents" badge={<span className="flex items-center gap-1.5 text-success"><span className="status-dot" /> Ready</span>} /><div ref={history} className="chat-history" aria-live="polite"><div className="chat-welcome"><span className="ai-avatar"><Sparkles size={17} /></span><div className="min-w-0 flex-1"><div className="chat-name">Offboard AI <span>Knowledge assistant</span></div><div className="welcome-message"><p>A smooth handover starts with the right knowledge.</p><p>{workspace.offboarding.departingName}'s documents are ready. What would you like to know about their suppliers, contracts, or spend?</p></div></div></div>{messages.length === 0 && isSample && <div className="suggestions"><p className="small-label">A good place to start</p>{SUGGESTED_QUESTIONS.map((question) => <Button key={question} variant="outline" className="suggestion-button" onClick={() => ask(question)}>{question}<ArrowUpRight size={13} /></Button>)}</div>}{messages.map((message, index) => <div key={index} className={`chat-message fade-in ${message.role}`}>{message.role === "assistant" ? <><span className="ai-avatar"><Sparkles size={17} /></span><div className="min-w-0"><div className="chat-name">Offboard AI{message.cached && <span className="cached-tag">{CACHED_LABEL}</span>}</div><div className={`welcome-message ${message.failed ? "answer-failed" : ""}`}>{message.text}{message.sources && message.sources.length > 0 && <div className="source-chips">{answerSources(message.text, message.sources).map((source) => { const key = `${index}:${source.filename}`; const open = expanded === key; return <span key={source.filename} className="source-chip-wrap"><Button type="button" variant="outline" size="sm" className={`source-chip ${open ? "open" : ""}`} disabled={!source.excerpt} onClick={() => setExpanded(open ? null : key)}><FileText size={11} />{source.filename}</Button>{open && source.excerpt && <span className="source-excerpt">{source.excerpt}</span>}</span>; })}</div>}</div></div></> : <div className="user-bubble">{message.text}</div>}</div>)}{thinking && <div className="chat-message"><span className="ai-avatar"><Sparkles size={17} /></span><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" />Retrieving contract details…</div></div>}</div><div className="chat-composer"><form className="composer-form" onSubmit={(event: FormEvent) => { event.preventDefault(); ask(input); }}><input aria-label="Ask your procurement assistant" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about your procurement knowledge…" disabled={thinking} /><Button type="submit" size="icon" aria-label="Send message" disabled={!input.trim() || thinking} className="h-8 w-8">{thinking ? <Loader2 className="animate-spin" /> : <ArrowUp size={16} />}</Button></form><div className="composer-note"><span className="flex items-center gap-1"><ShieldCheck size={10} /> Answers cite the file they came from</span><span>Powered by Offboard.AI</span></div></div></div>
        </section> : <TaskRouter workspace={workspace} readOnly={readOnly} />}
        <footer className="footer"><span><ShieldCheck size={12} /> Built for continuity. Designed for confidence.</span><span>Offboard.AI <span className="mx-1">·</span> Procurement Continuity Engine</span></footer>
      </main></div>
    <NewOffboarding open={wizardOpen} onOpenChange={setWizardOpen} onDone={async (id) => { await queryClient.invalidateQueries({ queryKey: ["offboardings"] }); selectOffboarding(id); setView("knowledge"); }} />
  </div>;
}
function PanelHead({ icon: Icon, title, subtitle, badge }: { icon: typeof FileText; title: string; subtitle: string; badge: React.ReactNode }) { return <div className="panel-head"><div><h2 className="panel-title"><Icon />{title}</h2><p className="panel-subtitle">{subtitle}</p></div><span className="count-badge">{badge}</span></div>; }
