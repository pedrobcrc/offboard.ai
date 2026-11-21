import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("drizzle/migrations/0012_n8n_outcome_helpers.sql", "utf8");

describe("Outcome helper access rules", () => {
  for (const signature of ["n8n_outcomes_due(integer)", "n8n_outcomes_mark_sent(jsonb)"]) {
    it(`${signature} allows only the service role and revokes visitor execution`, () => {
      const statements = sql.split(";").map((statement) => statement.trim());
      const grant = statements.find((statement) => statement.startsWith(`GRANT EXECUTE ON FUNCTION public.${signature} TO `));
      const revoke = statements.find((statement) => statement.startsWith(`REVOKE EXECUTE ON FUNCTION public.${signature} FROM `));
      expect(grant?.split(" TO ")[1]?.split(",").map((role) => role.trim())).toEqual(["service_role"]);
      expect(revoke?.split(" FROM ")[1]?.split(",").map((role) => role.trim())).toEqual(["PUBLIC", "anon", "authenticated"]);
    });
  }
});