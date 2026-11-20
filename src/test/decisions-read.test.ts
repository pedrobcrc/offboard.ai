import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleDecisionsRead } from "@/lib/decisions-read.server";

const mock = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), order: vi.fn(), range: vi.fn(), eq: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: mock.from } }));
const offboardingId = "00000000-0000-4000-8000-0000000000a1";
const columns = "id,task_id,proposal_id,task_title,action,ai_proposal,final_decision,reason,created_at,offboarding_id";

function request(method = "GET", query = "", body?: string, authorized = true) {
  return new Request(`http://localhost/api/public/decisions-read${query}`, {
    method, headers: authorized ? { "x-n8n-secret": "test-only-shared-value" } : {},
    ...(body === undefined ? {} : { body }),
  });
}

describe("Read-only decisions endpoint", () => {
  beforeEach(() => {
    vi.stubEnv("N8N_SHARED_SECRET", "test-only-shared-value");
    vi.clearAllMocks();
    mock.from.mockReturnValue(mock);
    mock.select.mockReturnValue(mock);
    mock.order.mockReturnValue(mock);
    mock.range.mockResolvedValue({ data: [], error: null });
    mock.eq.mockResolvedValue({ data: [], error: null });
  });
  afterEach(() => vi.unstubAllEnvs());
  it("rejects a missing header before database access", async () => {
    expect((await handleDecisionsRead(request("GET", "", undefined, false))).status).toBe(401);
    expect(mock.from).not.toHaveBeenCalled();
  });
  it("rejects an incorrect header before database access", async () => {
    const req = request(); req.headers.set("x-n8n-secret", "incorrect-test-value");
    expect((await handleDecisionsRead(req)).status).toBe(401);
    expect(mock.from).not.toHaveBeenCalled();
  });
  it("fails closed when the secret is not configured", async () => {
    vi.stubEnv("N8N_SHARED_SECRET", "");
    expect((await handleDecisionsRead(request())).status).toBe(401);
    expect(mock.from).not.toHaveBeenCalled();
  });
  it.each(["GET", "POST"])("allows %s and reads only the requested columns in ascending order", async (method) => {
    const response = await handleDecisionsRead(request(method));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mock.from).toHaveBeenCalledWith("task_decisions");
    expect(mock.select).toHaveBeenCalledWith(columns);
    expect(mock.order).toHaveBeenCalledWith("created_at", { ascending: true });
  });
  it.each(["GET", "POST"])("filters %s by a query offboarding_id", async (method) => {
    expect((await handleDecisionsRead(request(method, `?offboarding_id=${offboardingId}`))).status).toBe(200);
    expect(mock.eq).toHaveBeenCalledWith("offboarding_id", offboardingId);
  });
  it("accepts the POST JSON filter", async () => {
    expect((await handleDecisionsRead(request("POST", "", JSON.stringify({ offboarding_id: offboardingId })))).status).toBe(200);
    expect(mock.eq).toHaveBeenCalledWith("offboarding_id", offboardingId);
  });
  it.each(["not-a-uuid", ""])("rejects invalid filters without reading rows", async (value) => {
    expect((await handleDecisionsRead(request("GET", `?offboarding_id=${value}`))).status).toBe(400);
    expect(mock.from).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON", async () => {
    expect((await handleDecisionsRead(request("POST", "", "{"))).status).toBe(400);
    expect(mock.from).not.toHaveBeenCalled();
  });
  it("returns all rows beyond the database page limit", async () => {
    const page = Array.from({ length: 1000 }, (_, id) => ({ id }));
    mock.range.mockResolvedValueOnce({ data: page, error: null }).mockResolvedValueOnce({ data: [{ id: 1000 }], error: null });
    const response = await handleDecisionsRead(request());
    expect(await response.json()).toHaveLength(1001);
    expect(mock.range).toHaveBeenNthCalledWith(2, 1000, 1999);
  });
  it("does not expose database errors", async () => {
    mock.range.mockResolvedValue({ data: null, error: { message: "internal details" } });
    const response = await handleDecisionsRead(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Unable to read decisions" });
  });
});