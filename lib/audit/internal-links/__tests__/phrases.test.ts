import { describe, it, expect } from "vitest";
import { buildPhraseCandidates, cleanTitle, normalizePhrase } from "../phrases";
import { makePage } from "../../rules/__tests__/fixtures";

describe("normalizePhrase", () => {
  it("lowercases and trims punctuation", () => {
    expect(normalizePhrase('"  Cloud Migration!  "')).toBe("cloud migration");
  });
  it("collapses internal whitespace", () => {
    expect(normalizePhrase("cloud   migration\n  steps")).toBe("cloud migration steps");
  });
});

describe("cleanTitle", () => {
  it("strips a brand suffix joined by a pipe", () => {
    expect(cleanTitle("Cloud Migration Steps for Teams | Acme Co", "Acme Co")).toBe("Cloud Migration Steps for Teams");
  });
  it("strips an em-dash separated brand suffix", () => {
    expect(cleanTitle("Cloud Migration Steps — Acme", null)).toBe("Cloud Migration Steps");
  });
  it("does not strip when the suffix is too long to be a brand", () => {
    expect(cleanTitle("Migration Steps | A Very Long Subtitle That Really Belongs To The Page", null))
      .toBe("Migration Steps | A Very Long Subtitle That Really Belongs To The Page");
  });
});

describe("buildPhraseCandidates", () => {
  it("orders by priority: h1 first, then title, then headings", () => {
    const target = makePage({
      title: "Managed IT Services for Small Business | Acme Co",
      h1_text: "Managed IT services",
      headings: [
        { level: 1, text: "Managed IT services" },
        { level: 2, text: "What we offer" },
        { level: 3, text: "Help desk" },
      ],
    });
    const phrases = buildPhraseCandidates({ target, brand: "Acme Co" });
    const sources = phrases.map((p) => p.source);
    expect(sources[0]).toBe("h1");
    expect(sources).toContain("title");
    expect(sources).toContain("h2");
  });

  it("excludes generic banned anchors and stopword-only phrases", () => {
    const target = makePage({
      h1_text: "Click Here",
      title: "Read More | Acme",
      headings: [{ level: 2, text: "Of the and" }],
    });
    const phrases = buildPhraseCandidates({ target });
    expect(phrases).toHaveLength(0);
  });

  it("only pulls in keywords that share content words with the target", () => {
    const target = makePage({
      title: "Cloud Migration Planning | Acme",
      h1_text: "Cloud migration planning",
      headings: null,
    });
    const phrases = buildPhraseCandidates({
      target,
      brand: "Acme",
      keywords: ["cloud migration steps", "best espresso machines for home", "hybrid cloud strategy"],
    });
    const kwPhrases = phrases.filter((p) => p.source === "keyword").map((p) => p.text);
    expect(kwPhrases).toContain("cloud migration steps");
    expect(kwPhrases).toContain("hybrid cloud strategy");
    expect(kwPhrases).not.toContain("best espresso machines for home");
  });

  it("dedupes when h1 equals cleaned title", () => {
    const target = makePage({
      title: "Cloud Migration Steps | Acme",
      h1_text: "Cloud migration steps",
      headings: null,
    });
    const phrases = buildPhraseCandidates({ target, brand: "Acme" });
    const texts = phrases.map((p) => p.text);
    const dupes = texts.filter((t) => t === "cloud migration steps");
    expect(dupes.length).toBe(1);
  });
});
