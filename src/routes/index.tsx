import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDownToLine, ArrowRight, ArrowUp, ArrowUpRight, Bell, BookOpen, Check, CheckCheck, ChevronRight, CircleCheck, Clock3, FileSpreadsheet, FileText, GitBranch, Layers3, Loader2, LockKeyhole, Mail, MoreHorizontal, Network, ShieldCheck, Sparkles, UploadCloud, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { allocations, getDemoAnswer, indexedFiles, team } from "@/lib/procurement-demo";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Offboard.AI — Procurement Continuity Engine" },
    { name: "description", content: "Preserve supplier knowledge and confidently distribute procurement work with Offboard.AI." },
    { property: "og:title", content: "Offboard.AI — Procurement Continuity Engine" },
    { property: "og:description", content: "A connected workspace for procurement knowledge and team continuity." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Dashboard,
});

type View = "knowledge" | "tasks";
type Message = { role: "user" | "assistant"; text: string; source?: boolean };

function Dashboard() {
  const [view, setView] = useState<View>("knowledge");
  const [files, setFiles] = useState(indexedFiles);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [allocationState, setAllocationState] = useState<"idle" | "loading" | "done">("idle");
  const [sidebarPeeking, setSidebarPeeking] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const history = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { timers.current.forEach(clearTimeout); if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  function peek(on: boolean) {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    if (on) setSidebarPeeking(true);
    else closeTimer.current = setTimeout(() => setSidebarPeeking(false), 180);
  }
  useEffect(() => { if (messages.length || thinking) history.current?.scrollTo({ top: history.current.scrollHeight, behavior: "smooth" }); }, [messages, thinking]);

  function ask(question: string) {
    if (!question.trim() || thinking) return;
    setMessages((current) => [...current, { role: "user", text: question.trim() }]);
    setInput(""); setThinking(true);
    timers.current.push(setTimeout(() => {
      setMessages((current) => [...current, { role: "assistant", text: getDemoAnswer(question), source: question.toLowerCase().includes("amcor") && question.toLowerCase().includes("discount") }]);
      setThinking(false);
    }, 1000));
  }
  function upload(selected: FileList | null) {
    if (!selected?.length) return;
    const additions = Array.from(selected).map((file) => ({ name: file.name, kind: file.name.split(".").pop()?.toUpperCase() || "FILE", size: file.size >= 1048576 ? `${(file.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`, detail: "Demo upload" }));
    setUploading(true);
    timers.current.push(setTimeout(() => {
      setFiles((current) => [...current, ...additions.filter((file) => !current.some((existing) => existing.name === file.name))]);
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }, 1000));
  }
  function distribute() {
    setAllocationState("loading");
    timers.current.push(setTimeout(() => setAllocationState("done"), 1500));
  }
  const tabs = [{ id: "knowledge" as const, label: "Knowledge Retriever", icon: BookOpen }, { id: "tasks" as const, label: "Task Router", icon: GitBranch }];
  return <div className="app-shell">
    <div className="sidebar-hover-zone" aria-hidden="true" onMouseEnter={() => peek(true)} />
    <aside className={`sidebar ${sidebarPeeking ? "peeking" : ""}`} onMouseLeave={() => peek(false)} onFocusCapture={() => peek(true)} onKeyDown={(event) => { if (event.key === "Escape") peek(false); }}>
      <div><div className="brand"><span className="brand-icon"><Network size={23} strokeWidth={1.8} /></span><span>Offboard<span className="brand-ai">.AI</span></span></div><p className="brand-subtitle">Procurement continuity engine</p></div>
      <nav aria-label="Main navigation"><p className="nav-label">WORKSPACE</p>{tabs.map(({ id, label, icon: Icon }) => <Button key={id} variant="ghost" className={`nav-button ${view === id ? "active" : ""}`} onClick={() => setView(id)} aria-current={view === id ? "page" : undefined}><Icon size={18} />{label}{view === id && <ChevronRight className="ml-auto" size={14} />}</Button>)}</nav>
      <div className="sidebar-bottom"><div className="workspace-box"><div className="flex items-center gap-2"><span className="status-dot" /><strong className="text-[11px]">Continuity workspace</strong></div><p>Your knowledge stays.<br />Your business moves forward.</p><div className="mt-3 flex items-center gap-1.5 text-[9px] text-muted-foreground"><ShieldCheck size={12} /> Private demo environment</div></div><div className="profile"><span className="avatar">AC</span><div><strong>Alex Carter</strong><p>Procurement Manager</p></div><span className="ml-auto text-muted-foreground"><MoreHorizontal size={16} /></span></div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb"><Layers3 size={15} /><span>Workspace</span><ChevronRight size={12} /><strong>{view === "knowledge" ? "Knowledge Retriever" : "Task Router"}</strong></div><div className="topbar-right"><span className="online"><span className="status-dot" /> Workspace active</span><span className="demo-tag">DEMO</span><span className="text-muted-foreground" title="No new notifications"><Bell size={17} /></span><span className="avatar">AC</span></div></header>
      <main className="main-content"><div className="page-title-row"><div><p className="eyebrow"><Sparkles size={12} /> Procurement intelligence</p><h1>{view === "knowledge" ? "Knowledge Retriever" : "Task Router"}</h1><p className="page-subtitle">{view === "knowledge" ? "Keep the knowledge. Maintain the momentum." : "The right work. The right people. A seamless handover."}</p></div><div className="security-badge"><ShieldCheck size={15} /> Procurement continuity, by design</div></div>
        <section className="stats" aria-label="Workspace overview"><Stat icon={FileText} label="Indexed documents" value={String(files.length).padStart(2,"0")} note="Ready for retrieval" /><Stat icon={CheckCheck} label="Knowledge status" value="Up to date" note="All sources available" /><Stat icon={Users} label="Connected team" value="03" note="Procurement specialists" /></section>
        <div className="view-tabs" role="tablist" aria-label="Workspace views">{tabs.map(({id,label,icon:Icon}) => <Button key={id} role="tab" aria-selected={view === id} aria-controls={`${id}-panel`} id={`${id}-tab`} variant="ghost" className={`tab-button ${view === id ? "active" : ""}`} onClick={() => setView(id)}><Icon size={15} />{label}</Button>)}</div>
        {view === "knowledge" ? <section className="retriever-grid fade-in" role="tabpanel" id="knowledge-panel" aria-labelledby="knowledge-tab">
          <div className="panel"><PanelHead icon={FileText} title="Knowledge sources" subtitle="Your procurement source of truth" badge={String(files.length)} /><div className="ingestion-body"><div className={`drop-zone ${dragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); upload(event.dataTransfer.files); }}><div className="upload-icon">{uploading ? <Loader2 className="animate-spin" size={22} /> : <UploadCloud size={23} strokeWidth={1.6} />}</div><h3>{uploading ? "Adding your documents…" : "Drop your documents here"}</h3><p>Keep every detail within reach.</p><Button variant="outline" size="sm" className="text-[10px]" disabled={uploading} onClick={() => fileInput.current?.click()}><ArrowUpRight size={12} />Browse files</Button><input ref={fileInput} type="file" multiple accept=".pdf,.eml,.xlsx,.xls,.doc,.docx,.txt,.csv" hidden onChange={(event) => upload(event.target.files)} /><p className="file-types">PDF, EML, XLSX, DOCX, TXT & CSV</p></div><div className="indexed-heading"><span>Successfully Indexed Files</span><span className="count-badge">{files.length} files</span></div><div>{files.map((file) => <div className="file-row fade-in" key={file.name}><span className={`file-icon ${file.kind.toLowerCase()}`}>{file.kind === "EML" ? <Mail size={17} /> : file.kind === "XLSX" ? <FileSpreadsheet size={17} /> : <FileText size={17} />}</span><div className="file-info"><strong>{file.name}</strong><p>{file.size} <span className="mx-1">·</span> {file.detail}</p></div><CircleCheck className="file-check" size={14} /></div>)}</div></div><div className="ingestion-note"><LockKeyhole size={12} /> Demo files · Session only · No live indexing</div></div>
          <div className="panel chat-panel"><PanelHead icon={Sparkles} title="Procurement assistant" subtitle="Answers grounded in your documents" badge={<span className="flex items-center gap-1.5 text-success"><span className="status-dot" /> Ready</span>} /><div ref={history} className="chat-history" aria-live="polite"><div className="chat-welcome"><span className="ai-avatar"><Sparkles size={17} /></span><div className="min-w-0 flex-1"><div className="chat-name">Offboard AI <span>Knowledge assistant</span></div><div className="welcome-message"><p>A smooth handover starts with the right knowledge.</p><p>Your procurement documents are ready. What would you like to know about your suppliers, contracts, or spend?</p></div></div></div>{messages.length === 0 && <div className="suggestions"><p className="small-label">A good place to start</p><Button variant="outline" className="suggestion-button" onClick={() => ask("What is our volume discount with AMCOR?")}>What is our volume discount with AMCOR?<ArrowUpRight size={13} /></Button><Button variant="outline" className="suggestion-button" onClick={() => ask("Who is our AMCOR account manager and what is the volume discount?")}>Who is our primary contact at AMCOR?<ArrowUpRight size={13} /></Button></div>}{messages.map((message,index) => <div key={index} className={`chat-message fade-in ${message.role}`}>{message.role === "assistant" ? <><span className="ai-avatar"><Sparkles size={17} /></span><div className="min-w-0"><div className="chat-name">Offboard AI</div><div className="welcome-message">{message.text}{message.source && <span className="source-link"><FileText size={12} />AMCOR_Paper_Supplier_Contract.pdf</span>}</div></div></> : <div className="user-bubble">{message.text}</div>}</div>)}{thinking && <div className="chat-message"><span className="ai-avatar"><Sparkles size={17} /></span><div className="flex items-center gap-2 text-[11px] text-muted-foreground"><Loader2 size={14} className="animate-spin" />Retrieving contract details…</div></div>}</div><div className="chat-composer"><form className="composer-form" onSubmit={(event: FormEvent) => {event.preventDefault(); ask(input);}}><input aria-label="Ask your procurement assistant" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about your procurement knowledge…" disabled={thinking} /><Button type="submit" size="icon" aria-label="Send message" disabled={!input.trim() || thinking} className="h-8 w-8">{thinking ? <Loader2 className="animate-spin" /> : <ArrowUp size={16} />}</Button></form><div className="composer-note"><span className="flex items-center gap-1"><ShieldCheck size={10} /> Mock answers grounded in demo contract terms</span><span>Powered by Offboard.AI</span></div></div></div>
        </section> : <section className="fade-in" role="tabpanel" id="tasks-panel" aria-labelledby="tasks-tab"><div className="task-grid"><div className="panel"><PanelHead icon={BookOpen} title="Departing Buyer's Pending Tasks" subtitle="Open priorities for a seamless transition" badge="3 tasks" /><div className="task-body">{["Renegotiate Q3 plastics rate", "Finalize AMCOR paper renewal", "Resolve shipping delay with Logistics Corp"].map((task,index) => <div className="pending-task" key={task}><span className="task-number">0{index+1}</span><span>{task}</span><Clock3 size={14} className="ml-auto shrink-0 text-muted-foreground" /></div>)}</div></div><div className="panel"><PanelHead icon={Users} title="Remaining Team Capacity" subtitle="Expertise and current workload" badge="3 buyers" /><div className="task-body">{team.map((person) => <div className="team-row" key={person.name}><div className="team-info"><span className={`avatar ${person.tone}`}>{person.initials}</span><div><strong>{person.name}</strong><p>{person.expertise}</p></div><span className={`workload ${person.tone}`}>{person.workload} Workload</span></div><div className="capacity-track" role="progressbar" aria-label={`${person.name}'s workload`} aria-valuenow={person.capacity} aria-valuemin={0} aria-valuemax={100}><span className={`capacity-fill ${person.tone} capacity-${person.capacity}`} /></div></div>)}</div></div></div><div className="allocation-action"><p><ShieldCheck size={13} /> Expertise-led decisions. Capacity-aware assignments.</p><Button onClick={distribute} disabled={allocationState === "loading"}>{allocationState === "loading" ? <Loader2 className="animate-spin" /> : <Sparkles size={16} />}{allocationState === "loading" ? "Matching tasks to your team…" : "Distribute Workload via AI"}{allocationState !== "loading" && <ArrowRight size={15} />}</Button></div><div className="panel" aria-live="polite"><PanelHead icon={GitBranch} title="Workload allocation" subtitle="A clear owner for every next step" badge={allocationState === "done" ? <span className="text-success">3 tasks assigned</span> : "Awaiting allocation"} />{allocationState === "done" ? <div className="table-wrap fade-in"><table><thead><tr><th>Pending task</th><th>Assigned buyer</th><th>Allocation rationale</th></tr></thead><tbody>{allocations.map((row) => <tr key={row.task}><td>{row.task}</td><td><span className="assignee"><span className={`avatar ${row.tone}`}>{row.initials}</span>{row.buyer}</span></td><td>{row.rationale}</td></tr>)}</tbody></table></div> : <div className="allocation-empty"><div className="upload-icon">{allocationState === "loading" ? <Loader2 className="animate-spin" size={21} /> : <GitBranch size={21} />}</div><h3>{allocationState === "loading" ? "Finding the best fit for every task" : "Ready for the next chapter"}</h3><p>{allocationState === "loading" ? "Considering supplier relationships, expertise, and available capacity…" : "Your team's next assignments will appear here."}</p></div>}</div></section>}
        <footer className="footer"><span><ShieldCheck size={12} /> Built for continuity. Designed for confidence.</span><span>Offboard.AI <span className="mx-1">·</span> Procurement Continuity Engine</span></footer>
      </main></div>
  </div>;
}
function Stat({icon:Icon,label,value,note}: {icon: typeof FileText;label:string;value:string;note:string}) {return <div className="stat"><span className="stat-icon"><Icon size={20} strokeWidth={1.7} /></span><div><p className="stat-label">{label}</p><div className="stat-value">{value}<span className="stat-note">{note}</span></div></div></div>;}
function PanelHead({icon:Icon,title,subtitle,badge}: {icon:typeof FileText;title:string;subtitle:string;badge:React.ReactNode}) {return <div className="panel-head"><div><h2 className="panel-title"><Icon />{title}</h2><p className="panel-subtitle">{subtitle}</p></div><span className="count-badge">{badge}</span></div>;}
