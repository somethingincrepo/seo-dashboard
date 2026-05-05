import { describe, it, expect } from "vitest";
import { extractBody } from "../extract";
import { findMatchesInBlock, scanBody } from "../scan";

const phrase = (text: string, priority = 1) => ({ text, priority, source: "h1" as const });

describe("findMatchesInBlock", () => {
  it("matches whole-word, case-insensitive", () => {
    const { blocks } = extractBody(`<html><body><main>
      <p>We offer Cloud Migration Steps for enterprise teams in the cloud era today.</p>
    </main></body></html>`);
    const matches = findMatchesInBlock(blocks[0], phrase("cloud migration steps"));
    expect(matches).toHaveLength(1);
    expect(blocks[0].text.slice(matches[0].text_start, matches[0].text_end)).toBe("Cloud Migration Steps");
  });

  it("does NOT match a substring inside a larger word", () => {
    const { blocks } = extractBody(`<html><body><main>
      <p>The intercloudish gathering of supercloud people lasted all afternoon.</p>
    </main></body></html>`);
    const matches = findMatchesInBlock(blocks[0], phrase("cloud"));
    expect(matches).toHaveLength(0);
  });

  it("skips matches that fall inside an existing anchor", () => {
    const { blocks } = extractBody(`<html><body><main>
      <p>Our <a href="/services/">managed services</a> team is ready, and managed services come standard.</p>
    </main></body></html>`);
    const matches = findMatchesInBlock(blocks[0], phrase("managed services"));
    expect(matches).toHaveLength(1);
    expect(blocks[0].text.slice(matches[0].text_start, matches[0].text_end)).toBe("managed services");
    // The match should be the second occurrence (the first is inside <a>)
    const firstOccurrence = blocks[0].text.indexOf("managed services");
    expect(matches[0].text_start).toBeGreaterThan(firstOccurrence);
  });

  it("returns multiple matches when phrase appears more than once outside anchors", () => {
    const { blocks } = extractBody(`<html><body><main>
      <p>Cloud migration is hard; cloud migration done right is the only path forward today.</p>
    </main></body></html>`);
    const matches = findMatchesInBlock(blocks[0], phrase("cloud migration"));
    expect(matches).toHaveLength(2);
  });
});

describe("scanBody", () => {
  it("returns matches sorted deterministically by block, position, priority, text", () => {
    const { blocks } = extractBody(`<html><body><main>
      <p>Managed services teams are great. Help desk teams are great too in our experience.</p>
      <p>Help desk responsibilities include first-line support and escalation handoffs.</p>
    </main></body></html>`);
    const phrases = [
      { text: "managed services", priority: 1, source: "h1" as const },
      { text: "help desk", priority: 3, source: "h2" as const },
    ];
    const matches = scanBody(blocks, phrases);
    expect(matches.length).toBeGreaterThan(0);
    // First match should be in block 0 at the earliest position
    expect(matches[0].block_index).toBe(0);
    // Reordering input phrases must not change output order
    const matches2 = scanBody(blocks, [...phrases].reverse());
    expect(JSON.stringify(matches)).toEqual(JSON.stringify(matches2));
  });
});
