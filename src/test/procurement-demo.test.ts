import { describe, expect, it } from "vitest";
import {
  CACHED_ALLOCATIONS,
  CACHED_ANSWERS,
  CACHED_LABEL,
  NOT_FOUND_ANSWER,
  SUGGESTED_QUESTIONS,
  fileExtension,
  formatFileSize,
  isAcceptedFilename,
} from "@/lib/procurement-demo";

describe("Upload file rules", () => {
  it.each(["notes.txt", "brief.md", "thread.eml", "spend.csv", "contract.pdf"])(
    "accepts %s",
    (filename) => expect(isAcceptedFilename(filename)).toBe(true),
  );
  it.each(["contract.docx", "setup.exe", "image.png", "noextension"])(
    "rejects %s",
    (filename) => expect(isAcceptedFilename(filename)).toBe(false),
  );
  it("reads the extension without caring about case", () => {
    expect(fileExtension("Contract.PDF")).toBe("pdf");
  });
});

describe("File size labels", () => {
  it("shows megabytes above 1 MB", () => expect(formatFileSize(2_517_000)).toBe("2.4 MB"));
  it("shows kilobytes below 1 MB", () => expect(formatFileSize(866_000)).toBe("846 KB"));
});

describe("Suggested questions", () => {
  it("are the three questions the brief asked for, in order", () => {
    expect(SUGGESTED_QUESTIONS).toEqual([
      "Are there any open issues with PlasticsCorp?",
      "Which deadlines fall in the next 30 days?",
      "What did Laura agree informally that isn't in any contract?",
    ]);
  });
});

describe("Cached demo-mode answers", () => {
  it("are labelled so they are never mistaken for a live answer", () => {
    expect(CACHED_LABEL).toBe("Cached answer");
  });
  it("cover every suggested question", () => {
    for (const question of SUGGESTED_QUESTIONS) {
      expect(CACHED_ANSWERS[question]?.answer).toBeTruthy();
      expect(CACHED_ANSWERS[question]?.sources.length).toBeGreaterThan(0);
    }
  });
  it("carry the open PlasticsCorp issues: 8% increase and lot #4471 at 12% defects", () => {
    const answer = CACHED_ANSWERS[SUGGESTED_QUESTIONS[0]]?.answer ?? "";
    expect(answer).toContain("8%");
    expect(answer).toContain("lot #4471");
    expect(answer).toContain("12%");
  });
  it("carry every near deadline: 30 Nov, 5 Dec and 15 Dec 2026", () => {
    const answer = CACHED_ANSWERS[SUGGESTED_QUESTIONS[1]]?.answer ?? "";
    expect(answer).toContain("30 Nov 2026");
    expect(answer).toContain("5 Dec 2026");
    expect(answer).toContain("15 Dec 2026");
  });
  it("carry the informal K-Fair cap of 4%", () => {
    const answer = CACHED_ANSWERS[SUGGESTED_QUESTIONS[2]]?.answer ?? "";
    expect(answer).toContain("K-Fair");
    expect(answer).toContain("4%");
  });
});

describe("Workload allocation", () => {
  it("gives every pending task to a different buyer", () => {
    const buyers = CACHED_ALLOCATIONS.map((row) => row.buyer);
    expect(buyers).toHaveLength(3);
    expect(new Set(buyers).size).toBe(3);
  });
  it("matches each task to the buyer with the relevant expertise", () => {
    expect(CACHED_ALLOCATIONS.find((row) => row.task === "Renegotiate Q3 plastics rate")?.buyer).toBe("Mike");
    expect(CACHED_ALLOCATIONS.find((row) => row.task === "Finalize AMCOR paper renewal")?.buyer).toBe("Sarah");
    expect(CACHED_ALLOCATIONS.find((row) => row.task === "Resolve shipping delay with Logistics Corp")?.buyer).toBe("David");
  });
});

describe("Unanswerable questions", () => {
  it("use the exact refusal wording instead of inventing an answer", () => {
    expect(NOT_FOUND_ANSWER).toBe("I couldn't find this in the departing buyer's files");
  });
});
