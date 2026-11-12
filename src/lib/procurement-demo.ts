// Browser-safe demo helpers: the questions the assistant suggests, the pre-saved
// answers used only when Demo mode is on and an AI call fails, and the file rules
// the upload flow applies before anything reaches the backend.

export const SUGGESTED_QUESTIONS = [
  "Are there any open issues with PlasticsCorp?",
  "Which deadlines fall in the next 30 days?",
  "What did Laura agree informally that isn't in any contract?",
] as const;

/** The exact wording required when the retrieved chunks do not contain the answer. */
export const NOT_FOUND_ANSWER = "I couldn't find this in the departing buyer's files";

export type CachedAnswer = { answer: string; sources: string[] };

/** Pre-saved answers, used only in Demo mode when an AI call fails or credits run out. */
export const CACHED_ANSWERS: Record<string, CachedAnswer> = {
  [SUGGESTED_QUESTIONS[0]]: {
    answer:
      "Yes. PlasticsCorp proposes an 8% resin price increase from 1 January 2027, and the quality dispute on lot #4471 is still open with a 12% defect rate and no credit note issued.",
    sources: ["Email_Log_PlasticsCorp.eml", "Laura_Personal_Notes.docx"],
  },
  [SUGGESTED_QUESTIONS[1]]: {
    answer:
      "ChemSol price protection expires 30 Nov 2026 with the renewal not started, NordSteel needs the 2027 volume forecast by 5 Dec 2026, and the AMCOR contract renewal deadline is 15 Dec 2026.",
    sources: [
      "Laura_Personal_Notes.docx",
      "ChemSol_Contract.pdf",
      "AMCOR_Paper_Supplier_Contract.pdf",
    ],
  },
  [SUGGESTED_QUESTIONS[2]]: {
    answer:
      "At the K-Fair trade show Laura gave PlasticsCorp a verbal handshake agreement that any 2027 resin increase is capped at 4%. It was never formalised, so no contract carries it.",
    sources: ["Laura_Personal_Notes.docx"],
  },
};

/** Pre-saved allocation, used only in Demo mode when the AI distribution call fails. */
export const CACHED_ALLOCATIONS = [
  {
    task: "Renegotiate Q3 plastics rate",
    buyer: "Mike",
    initials: "MT",
    tone: "amber",
    rationale: "Plastics expertise and supplier history, despite high current workload.",
  },
  {
    task: "Finalize AMCOR paper renewal",
    buyer: "Sarah",
    initials: "SJ",
    tone: "green",
    rationale: "Packaging expertise and the highest available capacity on the team.",
  },
  {
    task: "Resolve shipping delay with Logistics Corp",
    buyer: "David",
    initials: "DC",
    tone: "blue",
    rationale: "Direct match for logistics expertise at medium workload.",
  },
] as const;

export const ACCEPTED_EXTENSIONS = ["txt", "md", "eml", "csv", "pdf"] as const;

export function fileExtension(filename: string): string {
  return filename.toLowerCase().split(".").pop() ?? "";
}

export function isAcceptedFilename(filename: string): boolean {
  return (ACCEPTED_EXTENSIONS as readonly string[]).includes(fileExtension(filename));
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Cached answers are labelled so a demo-mode reply is never mistaken for a live one. */
export const CACHED_LABEL = "Cached answer";
