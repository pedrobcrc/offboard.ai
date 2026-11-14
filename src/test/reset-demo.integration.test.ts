import { expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

// Opt in explicitly: this integration check resets the shared demo workspace.
it.skipIf(process.env["RUN_DEMO_RESET_TEST"] !== "1")("reset removes uploaded files and chunks but preserves all six seeded files and chunks", async () => {
  const client = createClient(import.meta.env["VITE_SUPABASE_URL"], import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]);
  const seeded = ["AMCOR_Paper_Supplier_Contract.pdf", "Email_Log_PlasticsCorp.eml", "Laura_Personal_Notes.docx", "LogisticsCorp_Service_Agreement.pdf", "ChemSol_Contract.pdf", "Q3_Vendor_Spend.xlsx"].sort();
  const before = await client.from("documents").select("id,filename").in("filename", seeded);
  expect(before.error).toBeNull();
  expect(before.data?.map((file) => file.filename).sort()).toEqual(seeded);
  const seedChunks = await client.from("document_chunks").select("id").in("document_id", (before.data ?? []).map((file) => file.id));
  expect(seedChunks.error).toBeNull();
  expect(seedChunks.data?.length).toBeGreaterThan(0);
  const upload = await client.from("documents").insert({ filename: `reset-regression-${Date.now()}.txt`, detail: "Uploaded document", kind: "TXT", size_label: "50 B", content: "Temporary visitor upload for the reset regression check." }).select("id").single();
  expect(upload.error).toBeNull();
  if (!upload.data) throw new Error("Test upload was not created");
  const id = upload.data.id;
  try {
    const indexed = await client.rpc("index_document", { p_document_id: id });
    expect(indexed.error).toBeNull();
    expect(indexed.data).toBeGreaterThan(0);
  } finally {
    const reset = await client.rpc("reset_task_demo");
    expect(reset.error).toBeNull();
  }
  const files = await client.from("documents").select("filename").eq("offboarding_id", "00000000-0000-4000-8000-0000000000a1");
  expect(files.error).toBeNull();
  expect(files.data?.map((file) => file.filename).sort()).toEqual(seeded);
  const removedChunks = await client.from("document_chunks").select("id").eq("document_id", id);
  expect(removedChunks.error).toBeNull();
  expect(removedChunks.data).toEqual([]);
  const remainingSeedChunks = await client.from("document_chunks").select("id").in("document_id", (before.data ?? []).map((file) => file.id));
  expect(remainingSeedChunks.error).toBeNull();
  expect(remainingSeedChunks.data?.map((chunk) => chunk.id).sort()).toEqual(seedChunks.data?.map((chunk) => chunk.id).sort());
});