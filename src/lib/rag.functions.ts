import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { WORKLOAD_CAP, isWorkloadWarning, allocateWithRetry, allocationSystemPrompt, buyerEditSchema, newOffboardingSchema, newTasksSchema, projectedWorkload, reviewSchema, type Criticality } from "@/lib/task-router";
import { NOT_FOUND_ANSWER } from "@/lib/procurement-demo";

/** Files the upload flow can read: plain text formats plus PDF (text extracted in the browser). */
export const ALLOWED_EXTENSIONS = ["txt", "md", "eml", "csv", "pdf"] as const;
const MAX_CONTENT_CHARS = 200_000;

export type DocumentRow = {
  id: string;
  filename: string;
  kind: string;
  sizeLabel: string;
  detail: string;
};

export type TeamRow = {
  id: string;
  name: string;
  initials: string;
  expertise: string;
  workload: string;
  capacity: number;
  tone: string;
};

export type TaskRow = {
  id: string;
  title: string;
  status: string;
  supplier: string;
  dueDate: string | null;
  criticality: Criticality;
  confidence: Criticality | null;
  sourceFile: string | null;
  assignedMemberId: string | null;
  assignedBuyer: string | null;
  assignedInitials: string | null;
  assignedTone: string | null;
  rationale: string | null;
  aiProposedBuyer: string | null;
  overridden: boolean;
};

export const SAMPLE_OFFBOARDING_ID = "00000000-0000-4000-8000-0000000000a1";

export type OffboardingRow = {
  id: string;
  departingName: string;
  departingRole: string;
  departingMemberId: string | null;
  lastWorkingDay: string;
  status: "draft" | "in_review" | "completed";
  isSample: boolean;
};

export type Workspace = {
  offboarding: OffboardingRow;
  documents: DocumentRow[];
  team: TeamRow[];
  tasks: TaskRow[];
  decisions: Database["public"]["Tables"]["task_decisions"]["Row"][];
  departingBuyer: { name: string; role: string; departingOn: string } | null;
};

export type AskResult =
  | { ok: true; answer: string; notFound: boolean; sources: { filename: string; excerpt: string }[] }
  | { ok: false; message: string };

/**
 * Read-only client for public demo data. The publishable key is opaque, not a JWT,
 * so the apikey header is sent on its own instead of the default bearer.
 */
function publicClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Lovable Cloud is not configured for this workspace.");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

function normalizeApostrophes(text: string) {
  return text.replace(/[\u2018\u2019\u02bc]/g, "'");
}

type OffboardingDb = Database["public"]["Tables"]["offboardings"]["Row"];
function toOffboarding(row: OffboardingDb): OffboardingRow {
  return { id: row.id, departingName: row.departing_name, departingRole: row.departing_role, departingMemberId: row.departing_member_id,
    lastWorkingDay: row.last_working_day, status: row.status as OffboardingRow["status"], isSample: row.is_sample };
}

/** Every offboarding, sample first, then newest first. */
export const listOffboardings = createServerFn({ method: "GET" }).handler(async (): Promise<OffboardingRow[]> => {
  const { data, error } = await publicClient().from("offboardings").select("*").order("is_sample", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toOffboarding);
});

/** All active (not departed) team members, for picking who is leaving. */
export const listTeam = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await publicClient().from("team_members").select("id, name, expertise").eq("departed", false).order("position");
  if (error) throw new Error(error.message);
  return data ?? [];
});

async function loadOffboarding(supabase: ReturnType<typeof publicClient>, id: string) {
  const { data } = await supabase.from("offboardings").select("*").eq("id", id).maybeSingle();
  return data ? toOffboarding(data) : null;
}

/** Documents, team, tasks and the departing buyer — the demo's default state. */
export const getWorkspace = createServerFn({ method: "GET" })
  .inputValidator((input: { offboardingId?: string } | undefined) => ({ offboardingId: input?.offboardingId ?? SAMPLE_OFFBOARDING_ID }))
  .handler(async ({ data: input }): Promise<Workspace> => {
  const supabase = publicClient();
  const ob = await supabase.from("offboardings").select("*").eq("id", input.offboardingId).maybeSingle();
  if (ob.error) throw new Error(ob.error.message);
  if (!ob.data) throw new Error("Offboarding not found.");
  const offboarding = toOffboarding(ob.data);
  const [documents, team, tasks, info, decisions] = await Promise.all([
    supabase
      .from("documents")
      .select("id, filename, kind, size_label, detail")
      .eq("offboarding_id", offboarding.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("team_members")
      .select("id, name, initials, expertise, workload, capacity, tone, departed")
      .order("position", { ascending: true }),
    supabase
      .from("tasks")
      .select("id, title, status, supplier, due_date, criticality, confidence, source_file, assigned_member_id, assigned_buyer, assigned_initials, assigned_tone, rationale, ai_proposed_buyer, overridden")
      .eq("offboarding_id", offboarding.id)
      .order("position", { ascending: true }),
    supabase
      .from("workspace_info")
      .select("departing_buyer_name, departing_buyer_role, departing_on")
      .eq("id", 1)
      .maybeSingle(),
    supabase.from("task_decisions").select("*").eq("offboarding_id", offboarding.id).order("created_at", { ascending: false }),
  ]);

  void info;
  const firstError = documents.error || team.error || tasks.error || info.error || decisions.error;
  if (firstError) throw new Error(firstError.message);

  return {
    decisions: decisions.data ?? [],
    documents: (documents.data ?? []).map((row) => ({
      id: row.id,
      filename: row.filename,
      kind: row.kind,
      sizeLabel: row.size_label,
      detail: row.detail,
    })),
    team: (team.data ?? []).filter((row) => !row.departed && row.id !== offboarding.departingMemberId).map((row) => ({
      id: row.id,
      name: row.name,
      initials: row.initials,
      expertise: row.expertise,
      workload: row.workload,
      capacity: row.capacity,
      tone: row.tone,
    })),
    tasks: (tasks.data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      supplier: row.supplier, dueDate: row.due_date, criticality: row.criticality as Criticality,
      confidence: row.confidence as Criticality | null, sourceFile: row.source_file, assignedMemberId: row.assigned_member_id,
      assignedBuyer: row.assigned_buyer,
      assignedInitials: row.assigned_initials,
      assignedTone: row.assigned_tone,
      rationale: row.rationale,
      aiProposedBuyer: row.ai_proposed_buyer,
      overridden: row.overridden,
    })),
    offboarding,
    departingBuyer: { name: offboarding.departingName, role: offboarding.departingRole, departingOn: offboarding.lastWorkingDay },
  };
});

/** Full-text retrieval over the indexed chunks, then one grounded model call. */
export const askAssistant = createServerFn({ method: "POST" })
  .inputValidator((input: { question: string; offboardingId?: string }) => ({ question: input.question, offboardingId: input.offboardingId ?? SAMPLE_OFFBOARDING_ID }))
  .handler(async ({ data }): Promise<AskResult> => {
    const question = data.question.trim();
    if (!question) return { ok: false, message: "Ask a question first." };

    const supabase = publicClient();
    const offboarding = await loadOffboarding(supabase, data.offboardingId);
    if (!offboarding) return { ok: false, message: "Offboarding not found." };
    const { data: chunks, error } = await supabase.rpc("search_offboarding_chunks", {
      p_offboarding_id: offboarding.id,
      p_question: question,
      p_limit: 4,
    });
    if (error) return { ok: false, message: error.message };
    if (!chunks?.length) {
      return { ok: true, answer: NOT_FOUND_ANSWER, notFound: true, sources: [] };
    }

    const sources: { filename: string; excerpt: string }[] = [];
    for (const chunk of chunks) {
      if (!sources.some((source) => source.filename === chunk.filename)) {
        sources.push({ filename: chunk.filename, excerpt: chunk.content });
      }
    }

    const context = chunks
      .map((chunk, index) => `[${index + 1}] ${chunk.filename}\n${chunk.content}`)
      .join("\n\n");

    const today = new Date().toISOString().slice(0, 10);
    const { askGateway } = await import("./ai.server");
    const result = await askGateway(
      [
        {
          role: "system",
          content:
            `You help a procurement team take over the work of ${offboarding.departingName} (${offboarding.departingRole}), whose last working day is ${offboarding.lastWorkingDay}. The excerpts come from their files. ` +
            "Answer only from the excerpts. Name the source file you used. " +
            "Reply in plain text: no markdown, no asterisks, no backticks. " +
            `Today is ${today}. Interpret relative dates such as "next 30 days" against today. ` +
            "When the question asks for a date range, list every dated item in the excerpts that falls inside it. " +
            `If the excerpts do not contain the answer, reply exactly: ${NOT_FOUND_ANSWER}. ` +
            "Max 90 words.",
        },
        { role: "user", content: `Question: ${question}\n\nExcerpts:\n${context}` },
      ],
      1500,
    );

    if (!result.ok) return { ok: false, message: result.message };

    const answer = result.text.trim();
    const notFound = normalizeApostrophes(answer)
      .toLowerCase()
      .includes(NOT_FOUND_ANSWER.toLowerCase());

    return {
      ok: true,
      answer: notFound ? NOT_FOUND_ANSWER : answer,
      notFound,
      sources: notFound ? [] : sources,
    };
  });

/** Stores an uploaded document and rebuilds its searchable chunks. */
export const uploadDocument = createServerFn({ method: "POST" })
  .inputValidator((input: { filename: string; content: string; sizeLabel: string; offboardingId?: string }) => ({ ...input, offboardingId: input.offboardingId ?? SAMPLE_OFFBOARDING_ID }))
  .handler(async ({ data }) => {
    const filename = data.filename.trim();
    const extension = filename.toLowerCase().split(".").pop() ?? "";
    if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(extension)) {
      return {
        ok: false as const,
        message: `Unsupported file type. Upload ${ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(", ")}.`,
      };
    }
    const content = data.content.trim();
    if (!content) {
      return { ok: false as const, message: "No text could be read from that file." };
    }
    if (content.length > MAX_CONTENT_CHARS) {
      return { ok: false as const, message: "That file is too large for this demo." };
    }

    const supabase = publicClient();
    const offboarding = await loadOffboarding(supabase, data.offboardingId);
    if (!offboarding) return { ok: false as const, message: "Offboarding not found." };
    if (offboarding.status === "completed") return { ok: false as const, message: "This offboarding is completed and read-only." };
    const { data: inserted, error } = await supabase
      .from("documents")
      .insert({
        offboarding_id: offboarding.id,
        filename,
        kind: extension.toUpperCase(),
        size_label: data.sizeLabel,
        detail: "Uploaded document",
        content,
      })
      .select("id, filename, kind, size_label, detail")
      .single();

    if (error) {
      return {
        ok: false as const,
        message: error.code === "23505" ? "That file is already indexed." : error.message,
      };
    }

    const { data: chunkCount, error: indexError } = await supabase.rpc("index_document", {
      p_document_id: inserted.id,
    });
    if (indexError) return { ok: false as const, message: indexError.message };

    return {
      ok: true as const,
      document: {
        id: inserted.id,
        filename: inserted.filename,
        kind: inserted.kind,
        sizeLabel: inserted.size_label,
        detail: inserted.detail,
      } satisfies DocumentRow,
      chunks: chunkCount ?? 0,
    };
  });

export const updateBuyer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => buyerEditSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: tasks, error: taskError } = await supabase.from("tasks").select("criticality").in("status", ["proposed", "approved"]).eq("assigned_member_id", data.id);
    if (taskError) return { ok: false as const, message: taskError.message };
    if (isWorkloadWarning(projectedWorkload(data.capacity, tasks ?? []))) return { ok: false as const, message: `Current assignments would push this buyer above ${WORKLOAD_CAP}%.` };
    const { error } = await supabase.from("team_members").update({ name: data.name, expertise: data.expertise, capacity: data.capacity, workload: `${data.capacity}%`, initials: data.name.split(/\s+/).map((word) => word[0]).join("").slice(0,2).toUpperCase() }).eq("id", data.id);
    return error ? { ok: false as const, message: error.message } : { ok: true as const };
  });

export const getDocumentText = createServerFn({ method: "POST" })
  .inputValidator((input: { filename: string; offboardingId?: string }) => ({ filename: input.filename, offboardingId: input.offboardingId ?? SAMPLE_OFFBOARDING_ID }))
  .handler(async ({ data }) => {
    const { data: document, error } = await publicClient().from("documents").select("filename, content").eq("offboarding_id", data.offboardingId).eq("filename", data.filename).single();
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const, document };
  });

export type DistributeResult = { ok: true; allocations: { task: string; buyer: string }[] } | { ok: false; message: string };

/** Retrieves supplier evidence, validates every allocation, and persists all assignments atomically. */
export const distributeWorkload = createServerFn({ method: "POST" })
  .inputValidator((input: { offboardingId?: string } | undefined) => ({ offboardingId: input?.offboardingId ?? SAMPLE_OFFBOARDING_ID }))
  .handler(async ({ data: input }): Promise<DistributeResult> => {
  const supabase = publicClient();
  const offboarding = await loadOffboarding(supabase, input.offboardingId);
  if (!offboarding) return { ok: false, message: "Offboarding not found." };
  if (offboarding.status === "completed") return { ok: false, message: "This offboarding is completed and read-only." };
  const [taskResult, teamResult] = await Promise.all([
    supabase.from("tasks").select("*").eq("offboarding_id", offboarding.id).order("position"),
    supabase.from("team_members").select("*").eq("departed", false).order("position"),
  ]);
  if (taskResult.error || teamResult.error) return { ok: false, message: taskResult.error?.message ?? teamResult.error?.message ?? "Cannot load the team." };
  const allTasks = taskResult.data ?? [];
  const tasks = allTasks.filter((task) => task.status === "pending");
  const team = (teamResult.data ?? []).filter((member) => member.id !== offboarding.departingMemberId);
  if (!tasks.length) return { ok: true, allocations: [] };
  if (!team.length) return { ok: false, message: "No buyers are available." };
  const currentLoads = new Map(team.map((member) => [member.id, projectedWorkload(member.capacity, allTasks.filter((task) => ["proposed", "approved"].includes(task.status) && task.assigned_member_id === member.id))]));
  const evidence = await Promise.all(tasks.map(async (task) => {
    const { data: chunks, error } = await supabase.rpc("search_offboarding_chunks", { p_offboarding_id: offboarding.id, p_question: task.supplier, p_limit: 4 });
    if (error) throw new Error(error.message);
    return { task_id: task.id, chunks: chunks ?? [] };
  })).catch(() => null);
  if (!evidence) return { ok: false, message: "Could not retrieve supplier evidence." };
  const { data: docs } = await supabase.from("documents").select("filename").eq("offboarding_id", offboarding.id);
  const { askGateway } = await import("./ai.server");
  const result = await allocateWithRetry((validationError) => askGateway([
    { role: "system", content: allocationSystemPrompt(offboarding, (docs ?? []).map((doc) => doc.filename)) },
    { role: "user", content: JSON.stringify({ departing_buyer: { name: offboarding.departingName, role: offboarding.departingRole, last_working_day: offboarding.lastWorkingDay }, tasks: tasks.map((task) => ({ task_id: task.id, title: task.title, supplier: task.supplier, due_date: task.due_date, criticality: task.criticality })), buyers: team.map((member) => ({ name: member.name, expertise: member.expertise, current_workload: currentLoads.get(member.id) })), evidence }) },
    ...(validationError ? [{ role: "user" as const, content: `Your previous allocation failed validation: ${validationError}\nCorrect this error and return a complete replacement JSON allocation for every task.` }] : []),
  ], 6000, true), { tasks, buyers: team.map((buyer) => ({ id: buyer.id, name: buyer.name, currentWorkload: currentLoads.get(buyer.id) ?? buyer.capacity })), evidence });
  if (!result.ok) return result;
  const { entries, payload } = result;
  const { error } = await supabase.rpc("apply_offboarding_allocations", { p_offboarding_id: offboarding.id, p_allocations: payload });
  if (error) return { ok: false, message: error.message };
  if (offboarding.status === "draft") await supabase.from("offboardings").update({ status: "in_review" }).eq("id", offboarding.id);
  return { ok: true, allocations: entries.map((entry) => ({ task: tasks.find((task) => task.id === entry.task_id)?.title ?? "", buyer: entry.assigned_buyer })) };
});

export const reviewTask = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => reviewSchema.parse(input))
  .handler(async ({ data }) => {
    const { error } = await publicClient().rpc("review_task", { p_task_id: data.taskId, p_action: data.action,
      ...(data.action === "reassign" ? { p_buyer_id: data.buyerId } : {}),
      p_reason: data.action === "approve" ? "" : data.reason });
    return error ? { ok: false as const, message: error.message } : { ok: true as const };
  });
export const approveRemaining = createServerFn({ method: "POST" })
  .inputValidator((input: { offboardingId?: string } | undefined) => ({ offboardingId: input?.offboardingId ?? SAMPLE_OFFBOARDING_ID }))
  .handler(async ({ data }) => {
  const { error } = await publicClient().rpc("approve_offboarding_tasks", { p_offboarding_id: data.offboardingId });
  return error ? { ok: false as const, message: error.message } : { ok: true as const };
});
export const resetTaskDemo = createServerFn({ method: "POST" }).handler(async () => {
  const { error } = await publicClient().rpc("reset_task_demo");
  return error ? { ok: false as const, message: error.message } : { ok: true as const };
});

/** Step 1 of a new offboarding: who is leaving. Starts as a draft. */
export const createOffboarding = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => newOffboardingSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    let name = data.name ?? ""; let role = data.role ?? "";
    if (data.memberId) {
      const { data: member, error } = await supabase.from("team_members").select("name, expertise, departed").eq("id", data.memberId).maybeSingle();
      if (error || !member || member.departed) return { ok: false as const, message: "That team member is not available." };
      name = member.name; role = role || member.expertise;
    }
    if (!name.trim() || !role.trim()) return { ok: false as const, message: "Add the person's name and role." };
    const { data: row, error } = await supabase.from("offboardings").insert({ departing_name: name.trim(), departing_role: role.trim(), departing_member_id: data.memberId ?? null, last_working_day: data.lastWorkingDay, status: "draft" }).select("id").single();
    return error ? { ok: false as const, message: error.message } : { ok: true as const, id: row.id };
  });

/** Step 3: the departing person's open tasks, added manually or from CSV. */
export const addOffboardingTasks = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => newTasksSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const offboarding = await loadOffboarding(supabase, data.offboardingId);
    if (!offboarding || offboarding.isSample || offboarding.status === "completed") return { ok: false as const, message: "Tasks can only be added to an open new offboarding." };
    const { count } = await supabase.from("tasks").select("id", { count: "exact", head: true }).eq("offboarding_id", offboarding.id);
    const { error } = await supabase.from("tasks").insert(data.tasks.map((task, index) => ({ offboarding_id: offboarding.id, title: task.title, supplier: task.supplier, due_date: task.dueDate, criticality: task.criticality, status: "pending", position: (count ?? 0) + index + 1 })));
    if (error) return { ok: false as const, message: error.message };
    await supabase.from("offboardings").update({ status: "in_review" }).eq("id", offboarding.id);
    return { ok: true as const };
  });

/** Closes a fully reviewed offboarding; it stays listed, read-only. */
export const completeOffboarding = createServerFn({ method: "POST" })
  .inputValidator((input: { offboardingId: string }) => input)
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const offboarding = await loadOffboarding(supabase, data.offboardingId);
    if (!offboarding || offboarding.isSample) return { ok: false as const, message: "The sample offboarding stays open for demos." };
    const { data: open } = await supabase.from("tasks").select("id").eq("offboarding_id", offboarding.id).neq("status", "approved");
    if (open?.length) return { ok: false as const, message: "Approve every task before completing this offboarding." };
    const { error } = await supabase.from("offboardings").update({ status: "completed" }).eq("id", offboarding.id);
    return error ? { ok: false as const, message: error.message } : { ok: true as const };
  });
