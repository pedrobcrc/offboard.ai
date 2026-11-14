import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { WORKLOAD_CAP } from "@/lib/task-router";

it("keeps both database capacity checks aligned with the shared 90% cap and changes nothing else", () => {
  const before = readFileSync("drizzle/migrations/0009_multi_offboarding.sql", "utf8");
  const after = readFileSync("drizzle/migrations/0010_workload_safety_cap.sql", "utf8");
  const functions = [
    ["validate_review_capacity", "END; $$;"],
    ["apply_offboarding_allocations", "END; $function$;"],
  ] as const;
  for (const [name, end] of functions) {
    const marker = `CREATE OR REPLACE FUNCTION public.${name}`;
    const start = before.indexOf(marker);
    const expected = before.slice(start, before.indexOf(end, start) + end.length)
      .replace(/>\s*100/g, (match) => match.replace("100", String(WORKLOAD_CAP)))
      .replaceAll("100 percent", `${WORKLOAD_CAP} percent`);
    expect(after).toContain(expected);
  }
  expect(after).toContain("IF load>90");
  expect(after).toContain("IF projected > 90");
});