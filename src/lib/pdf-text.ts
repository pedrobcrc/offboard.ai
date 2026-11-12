// Browser-only PDF text extraction. This module is dynamically imported from the
// upload handler so pdf.js is never evaluated during server rendering.
import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: string[] = [];
  for (let page = 1; page <= document.numPages; page += 1) {
    const content = await document.getPage(page);
    const text = await content.getTextContent();
    pages.push(
      text.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/[ \t]+/g, " "),
    );
  }
  await document.cleanup();
  return pages
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
