import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
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
  assignedBuyer: string | null;
  assignedInitials: string | null;
  assignedTone: string | null;
  rationale: string | null;
};

export type Workspace = {
  documents: DocumentRow[];
  team: TeamRow[];
  tasks: TaskRow[];
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

/** Documents, team, tasks and the departing buyer — the demo's default state. */
export const getWorkspace = createServerFn({ method: "GET" }).handler(async (): Promise<Workspace> => {
  const supabase = publicClient();
  const [documents, team, tasks, info] = await Promise.all([
    supabase
      .from("documents")
      .select("id, filename, kind, size_label, detail")
      .order("created_at", { ascending: true }),
    supabase
      .from("team_members")
      .select("id, name, initials, expertise, workload, capacity, tone")
      .order("position", { ascending: true }),
    supabase
      .from("tasks")
      .select("id, title, status, assigned_buyer, assigned_initials, assigned_tone, rationale")
      .order("position", { ascending: true }),
    supabase
      .from("workspace_info")
      .select("departing_buyer_name, departing_buyer_role, departing_on")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  const firstError = documents.error || team.error || tasks.error || info.error;
  if (firstError) throw new Error(firstError.message);

  return {
    documents: (documents.data ?? []).map((row) => ({
      id: row.id,
      filename: row.filename,
      kind: row.kind,
      sizeLabel: row.size_label,
      detail: row.detail,
    })),
    team: (team.data ?? []).map((row) => ({
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
      assignedBuyer: row.assigned_buyer,
      assignedInitials: row.assigned_initials,
      assignedTone: row.assigned_tone,
      rationale: row.rationale,
    })),
    departingBuyer: info.data
      ? {
          name: info.data.departing_buyer_name,
          role: info.data.departing_buyer_role,
          departingOn: info.data.departing_on,
        }
      : null,
  };
});

/** Full-text retrieval over the indexed chunks, then one grounded model call. */
export const askAssistant = createServerFn({ method: "POST" })
  .inputValidator((input: { question: string }) => input)
  .handler(async ({ data }): Promise<AskResult> => {
    const question = data.question.trim();
    if (!question) return { ok: false, message: "Ask a question first." };

    const supabase = publicClient();
    const { data: chunks, error } = await supabase.rpc("search_chunks", {
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
            "Answer only from the excerpts. Name the source file you used. " +
            `Today is ${today}. Interpret relative dates such as "next 30 days" against today. ` +
            "When the question asks for a date range, list every dated item in the excerpts that falls inside it. " +
            `If the excerpts do not contain the answer, reply exactly: ${NOT_FOUND_ANSWER}. ` +
            "Max 90 words.",
        },
        { role: "user", content: `Question: ${question}\n\nExcerpts:\n${context}` },
      ],
      400,
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
  .inputValidator((input: { filename: string; content: string; sizeLabel: string }) => input)
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
    const { data: inserted, error } = await supabase
      .from("documents")
      .insert({
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

export type AllocationRow = {
  task: string;
  buyer: string;
  initials: string;
  tone: string;
  rationale: string;
};

export type DistributeResult = { ok: true; allocations: AllocationRow[] } | { ok: false; message: string };

/** Extracts the first JSON array from a model reply. */
function parseJsonArray(text: string): unknown {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) throw new Error("no array");
  return JSON.parse(text.slice(start, end + 1));
}

/** Assigns every pending task to a team member with the AI model, then stores the result. */
export const distributeWorkload = createServerFn({ method: "POST" }).handler(
  async (): Promise<DistributeResult> => {
    const supabase = publicClient();
    const [pending, team] = await Promise.all([
      supabase
        .from("tasks")
        .select("id, title, position")
        .eq("status", "pending")
        .order("position", { ascending: true }),
      supabase
        .from("team_members")
        .select("id, name, initials, expertise, workload, capacity, tone")
        .order("position", { ascending: true }),
    ]);

    const firstError = pending.error || team.error;
    if (firstError) return { ok: false, message: firstError.message };

    const tasks = pending.data ?? [];
    const members = team.data ?? [];
    if (!tasks.length) return { ok: true, allocations: [] };
    if (!members.length) return { ok: false, message: "No team members are available to assign work." };

    const { askGateway } = await import("./ai.server");
    const result = await askGateway(
      [
        {
          role: "system",
          content:
            "Assign each task to exactly one team member, favouring expertise and available capacity. " +
            "Reply with json only: an array of objects with keys task, buyer and rationale. " +
            "Use only the task titles and buyer names given. rationale is one short sentence, max 22 words.",
        },
        {
          role: "user",
          content:
            `Tasks: ${tasks.map((task) => task.title).join("; ")}\n` +
            `Team: ${members
              .map((member) => `${member.name} (${member.expertise}, ${member.workload} workload, ${member.capacity}% used)`)
              .join("; ")}`,
        },
      ],
      600,
    );
    if (!result.ok) return { ok: false, message: result.message };

    let parsed: unknown;
    try {
      parsed = parseJsonArray(result.text);
    } catch {
      return { ok: false, message: "The AI service returned an unusable allocation." };
    }
    if (!Array.isArray(parsed)) return { ok: false, message: "The AI service returned an unusable allocation." };

    const allocations: AllocationRow[] = [];
    for (const item of parsed) {
      const entry = item as { task?: unknown; buyer?: unknown; rationale?: unknown };
      const task = tasks.find((row) => row.title === entry.task);
      const member = members.find((row) => row.name === entry.buyer);
      if (!task || !member) continue;
      allocations.push({
        task: task.title,
        buyer: member.name,
        initials: member.initials,
        tone: member.tone,
        rationale:
          typeof entry.rationale === "string" && entry.rationale.trim()
            ? entry.rationale.trim()
            : "Matched on expertise and available capacity.",
      });
    }
    if (!allocations.length) return { ok: false, message: "The AI service did not return a usable allocation." };

    for (const allocation of allocations) {
      const task = tasks.find((row) => row.title === allocation.task);
      if (!task) continue;
      const { error } = await supabase
        .from("tasks")
        .update({
          status: "assigned",
          assigned_buyer: allocation.buyer,
          assigned_initials: allocation.initials,
          assigned_tone: allocation.tone,
          rationale: allocation.rationale,
          assigned_at: new Date().toISOString(),
        })
        .eq("id", task.id);
      if (error) return { ok: false, message: error.message };
    }

    return { ok: true, allocations };
  },
);
