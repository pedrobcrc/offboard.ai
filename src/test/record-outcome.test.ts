import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleRecordOutcome } from "@/lib/record-outcome.server";

const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: mock.rpc } }));
const body = { proposal_id: "00000000-0000-4000-8000-000000000001", worked: "yes", supplier_term_lost: false, comment: null };
function request(value: unknown, secret: string | null = "test-only-secret") {
  return new Request("http://localhost/api/public/record-outcome", {
    method: "POST", headers: secret === null ? {} : { "x-n8n-secret": secret }, body: JSON.stringify(value),
  });
}
describe("Record outcome endpoint", () => {
  beforeEach(() => { vi.stubEnv("N8N_SHARED_SECRET", "test-only-secret"); vi.clearAllMocks(); });
  afterEach(() => vi.unstubAllEnvs());
  it.each([null, "wrong-secret"])("rejects unauthorized requests: %s", async (secret) => {
    expect((await handleRecordOutcome(request(body, secret))).status).toBe(401);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("fails closed without a configured secret", async () => {
    vi.stubEnv("N8N_SHARED_SECRET", "");
    expect((await handleRecordOutcome(request(body))).status).toBe(401);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it.each([
    [{ ...body, proposal_id: "invalid" }, "proposal_id must be a valid UUID"],
    [{ ...body, worked: "maybe" }, "worked must be yes, partly, or no"],
    [{ ...body, supplier_term_lost: "false" }, "supplier_term_lost must be a boolean"],
    [{ ...body, comment: 12 }, "comment must be a string or null"],
    [{ ...body, comment: "x".repeat(2001) }, "comment must be at most 2000 characters"],
  ])("rejects invalid input with a specific error", async (value, error) => {
    const response = await handleRecordOutcome(request(value));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error });
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it.each(["proposal_id", "worked", "supplier_term_lost"])("requires %s", async (field) => {
    const value = { ...body, [field]: undefined };
    expect((await handleRecordOutcome(request(value))).status).toBe(400);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON", async () => {
    const req = new Request("http://localhost/api/public/record-outcome", { method: "POST", headers: { "x-n8n-secret": "test-only-secret" }, body: "{" });
    const response = await handleRecordOutcome(req);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Request body must be valid JSON" });
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it.each(["yes", "partly", "no"])("binds accepted worked value %s and returns the updated row", async (worked) => {
    const row = { ...body, worked, task_id: body.proposal_id, offboarding_id: body.proposal_id, answered_at: "2026-11-21T23:24:00Z" };
    mock.rpc.mockResolvedValue({ data: { updated: 1, row }, error: null });
    const response = await handleRecordOutcome(request({ ...body, worked }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ updated: 1, row });
    expect(mock.rpc).toHaveBeenCalledWith("n8n_outcome_record", { p_proposal_id: body.proposal_id, p_worked: worked, p_supplier_term_lost: false, p_comment: null });
  });
  it.each([undefined, null, "x".repeat(2000)])("accepts optional/null/2000-character comment", async (comment) => {
    mock.rpc.mockResolvedValue({ data: { updated: 1, row: body }, error: null });
    expect((await handleRecordOutcome(request({ ...body, comment }))).status).toBe(200);
    expect(mock.rpc.mock.calls[0]?.[1]?.p_comment).toBe(comment ?? null);
  });
  it.each([["not_found", 404], ["already_answered", 409]])("maps %s to %s", async (error, status) => {
    mock.rpc.mockResolvedValue({ data: { error }, error: null });
    const response = await handleRecordOutcome(request(body));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error });
  });
  it("does not disclose database errors", async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { message: "private detail" } });
    const response = await handleRecordOutcome(request(body));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Unable to record outcome" });
  });
  it("restricts helper execution to service_role and locks before the guarded update", () => {
    const sql = readFileSync("drizzle/migrations/0013_n8n_outcome_record.sql", "utf8");
    expect(sql).toContain("REVOKE EXECUTE ON FUNCTION public.n8n_outcome_record(uuid, text, boolean, text) FROM PUBLIC, anon, authenticated;");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.n8n_outcome_record(uuid, text, boolean, text) TO service_role;");
    expect(sql).toContain("WHERE proposal_id = p_proposal_id FOR UPDATE");
    expect(sql).toContain("WHERE proposal_id = p_proposal_id AND answered_at IS NULL");
    expect(sql).not.toMatch(/INSERT INTO/i);
  });
});