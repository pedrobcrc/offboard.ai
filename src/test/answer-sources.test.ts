import { describe, expect, it } from "vitest";
import { answerSources } from "@/lib/answer-sources";

describe("Answer source selection", () => {
  const sources = [{ filename: "Laura_Personal_Notes.docx" }, { filename: "ChemSol_Contract.pdf" }, { filename: "Email_Log_PlasticsCorp.eml" }];
  it("shows only the retrieved filenames named by the answer", () => {
    expect(answerSources("See ChemSol_Contract.pdf and Email_Log_PlasticsCorp.eml.", sources)).toEqual(sources.slice(1));
  });
  it("falls back to only the top retrieved file when none is named", () => {
    expect(answerSources("Renewal is due on 30 Nov.", sources)).toEqual([sources[0]]);
  });
  it("matches filename casing without adding unmentioned sources", () => {
    expect(answerSources("CHEMSOL_CONTRACT.PDF", sources)).toEqual([sources[1]]);
  });
  it("shows no chips without retrieved sources", () => expect(answerSources("No answer found.", [])).toEqual([]));
});