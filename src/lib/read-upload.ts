import { fileExtension, isAcceptedFilename } from "@/lib/procurement-demo";

/** Reads an upload's text in the browser (PDF text is extracted locally). */
export async function readUploadFile(file: File): Promise<{ ok: true; content: string } | { ok: false; message: string }> {
  if (!isAcceptedFilename(file.name)) return { ok: false, message: `${file.name}: unsupported type. Use .txt, .md, .eml, .csv or .pdf.` };
  try {
    const content = fileExtension(file.name) === "pdf" ? await (await import("@/lib/pdf-text")).extractPdfText(file) : await file.text();
    return { ok: true, content };
  } catch { return { ok: false, message: `Could not read ${file.name}.` }; }
}
