import { describe, expect, it } from "vitest";
import { allocations, getAmcorTerms } from "@/lib/procurement-demo";

describe("Procurement demo rules", () => {
  it("retrieves a 15% discount for orders over 10,000 units", () => {
    const terms = getAmcorTerms("What is our volume discount with AMCOR?");
    expect(terms?.discountPercent).toBe(15);
    expect(terms?.unitThreshold).toBe(10000);
  });
  it("identifies Sarah Jenkins as AMCOR's account manager", () => {
    expect(getAmcorTerms("What is our volume discount with AMCOR?")?.accountManager).toBe("Sarah Jenkins");
  });
  it.each([["AMCOR renewal", "Sarah"], ["Plastics rate", "Mike"], ["Shipping delay", "David"]])("assigns %s to %s", (task, buyer) => {
    expect(allocations.find((row) => row.task === task)?.buyer).toBe(buyer);
  });
});