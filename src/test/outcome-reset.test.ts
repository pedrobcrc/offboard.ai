import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("drizzle/migrations/0014_demo_reset_with_outcomes.sql", "utf8");

describe("Outcome reset boundaries", () => {
  it("scopes outcome deletion to the sample offboarding and reuses the existing atomic reset", () => {
    expect(sql).toContain("PERFORM public.reset_task_demo();");
    expect(sql).toMatch(/DELETE FROM public\.allocation_outcomes\s+WHERE offboarding_id = '00000000-0000-4000-8000-0000000000a1';/);
  });
  it("permits only the service role to run the reset wrapper", () => {
    expect(sql).toContain("REVOKE EXECUTE ON FUNCTION public.reset_demo_with_outcomes() FROM PUBLIC, anon, authenticated;");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.reset_demo_with_outcomes() TO service_role;");
    expect(sql).toContain("SECURITY INVOKER");
    expect(sql).not.toMatch(/CREATE POLICY|ALTER TABLE|CREATE TRIGGER|CREATE OR REPLACE/);
  });
});