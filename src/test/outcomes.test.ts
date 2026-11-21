import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleOutcomesDue } from "@/lib/outcomes-due.server";
import { handleOutcomesMarkSent } from "@/lib/outcomes-mark-sent.server";

const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: mock.rpc } }));
const item = {
  proposal_id: "00000000-0000-4000-8000-000000000001",
  task_id: "00000000-0000-4000-8000-000000000002",
  offboarding_id: "00000000-0000-4000-8000-0000000000a1",
  due_date: "2026-11-21",
};
function request(body: unknown, secret: string | null = "test-only-secret") {
  return new Request("http://localhost/api/public/outcomes", {
    method: "POST", headers: secret === null ? {} : { "x-n8n-secret": secret },
    body: JSON.stringify(body),
  });
}
describe("Outcome endpoints", () => {
  beforeEach(() => {
    vi.stubEnv("N8N_SHARED_SECRET", "test-only-secret");
    vi.clearAllMocks();
    mock.rpc.mockResolvedValue({ data: [], error: null });
  });
  afterEach(() => vi.unstubAllEnvs());
  for (const handler of [handleOutcomesDue, handleOutcomesMarkSent]) {
    it.each([null, "wrong-secret"])(`${handler.name} rejects missing/wrong secrets`, async (secret) => {
      expect((await handler(request({}, secret))).status).toBe(401);
      expect(mock.rpc).not.toHaveBeenCalled();
    });
    it(`${handler.name} fails closed without a configured secret`, async () => {
      vi.stubEnv("N8N_SHARED_SECRET", "");
      expect((await handler(request({}))).status).toBe(401);
      expect(mock.rpc).not.toHaveBeenCalled();
    });
    it(`${handler.name} rejects malformed JSON before database access`, async () => {
      const req = new Request("http://localhost/outcomes", { method: "POST", headers: { "x-n8n-secret": "test-only-secret" }, body: "{" });
      expect((await handler(req)).status).toBe(400);
      expect(mock.rpc).not.toHaveBeenCalled();
    });
    it(`${handler.name} accepts POST only`, async () => {
      const req = new Request("http://localhost/outcomes", { headers: { "x-n8n-secret": "test-only-secret" } });
      expect((await handler(req)).status).toBe(405);
      expect(mock.rpc).not.toHaveBeenCalled();
    });
  }
  it.each([{}, { days: -1 }, { days: 366 }, { days: 1.5 }, { days: "2" }, { days: null }])("rejects invalid days %j", async (body) => {
    expect((await handleOutcomesDue(request(body))).status).toBe(400);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it.each([0, 365])("binds accepted boundary days %i", async (days) => {
    mock.rpc.mockResolvedValue({ data: [item], error: null });
    const response = await handleOutcomesDue(request({ days }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ rows: [item] });
    expect(mock.rpc).toHaveBeenCalledWith("n8n_outcomes_due", { p_days: days });
  });
  it.each([{}, { items: [] }, ...Object.keys(item).map((key) => ({ items: [{ ...item, [key]: undefined }] })), { items: [{ ...item, due_date: "2026-02-30" }] }, { items: [{ ...item, proposal_id: "invalid" }] }])("rejects invalid items %j", async (body) => {
    expect((await handleOutcomesMarkSent(request(body))).status).toBe(400);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("binds items and returns the actual database insert count", async () => {
    mock.rpc.mockResolvedValue({ data: 1, error: null });
    expect(await (await handleOutcomesMarkSent(request({ items: [item, item] }))).json()).toEqual({ inserted: 1 });
    expect(mock.rpc).toHaveBeenCalledWith("n8n_outcomes_mark_sent", { p_items: [item, item] });
  });
  it("returns zero for existing proposals", async () => {
    mock.rpc.mockResolvedValue({ data: 0, error: null });
    expect(await (await handleOutcomesMarkSent(request({ items: [item] }))).json()).toEqual({ inserted: 0 });
  });
  it("hides database errors", async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { message: "private detail" } });
    const response = await handleOutcomesDue(request({ days: 0 }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Unable to read due outcomes" });
  });
});