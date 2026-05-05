import { describe, it, expect } from "vitest";
import { extractBody } from "../extract";

describe("extractBody", () => {
  it("collects paragraph and list-item text from a simple page", () => {
    const html = `
      <html><body>
        <main>
          <h1>Welcome</h1>
          <p>We help small businesses automate their payroll and benefits.</p>
          <h2>Our services</h2>
          <p>From bookkeeping to compliance, our team handles the busywork.</p>
          <ul>
            <li>Bookkeeping for small teams of any size or stage</li>
            <li>Quarterly tax filings handled end-to-end</li>
          </ul>
        </main>
      </body></html>
    `;
    const { blocks, outline } = extractBody(html);
    expect(outline.map((o) => o.text)).toContain("Our services");
    const texts = blocks.map((b) => b.text);
    expect(texts).toContain("We help small businesses automate their payroll and benefits.");
    expect(texts).toContain("From bookkeeping to compliance, our team handles the busywork.");
    expect(texts).toContain("Bookkeeping for small teams of any size or stage");
  });

  it("drops nav, header, footer, aside trees entirely", () => {
    const html = `
      <html><body>
        <header><p>Brand name and primary nav lives in this header bar today</p></header>
        <nav><p>Login Sign up About Pricing Contact and more nav links here</p></nav>
        <main>
          <p>Real body paragraph that we expect to keep around for matching.</p>
        </main>
        <aside><p>Sidebar content advertising the latest e-book download promo</p></aside>
        <footer><p>Copyright and legal disclaimer text intentionally lengthy enough</p></footer>
      </body></html>
    `;
    const { blocks } = extractBody(html);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe("Real body paragraph that we expect to keep around for matching.");
  });

  it("ignores script and style content", () => {
    const html = `
      <html><body>
        <main>
          <script>const evil = "<p>not a paragraph</p>";</script>
          <style>p { color: red; }</style>
          <p>The visible paragraph that should be the only block returned here.</p>
        </main>
      </body></html>
    `;
    const { blocks } = extractBody(html);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toContain("The visible paragraph");
  });

  it("tracks anchored ranges so we can avoid placing links over existing links", () => {
    const html = `
      <html><body>
        <main>
          <p>Our <a href="/services/">managed services</a> team handles deployments and on-call rotations.</p>
        </main>
      </body></html>
    `;
    const { blocks } = extractBody(html);
    expect(blocks).toHaveLength(1);
    const block = blocks[0];
    expect(block.text).toBe("Our managed services team handles deployments and on-call rotations.");
    expect(block.anchored_ranges.length).toBe(1);
    const [s, e] = block.anchored_ranges[0];
    expect(block.text.slice(s, e)).toBe("managed services");
  });

  it("decodes HTML entities in text", () => {
    const html = `<html><body><main><p>This &amp; that &mdash; both work in tandem here today.</p></main></body></html>`;
    const { blocks } = extractBody(html);
    expect(blocks[0].text).toBe("This & that — both work in tandem here today.");
  });

  it("is fully deterministic — same input → same output", () => {
    const html = `
      <html><body><main>
        <p>Cloud migration steps for enterprise teams begin with assessment.</p>
        <p>After the assessment, the team builds a migration runbook to follow.</p>
      </main></body></html>
    `;
    const a = extractBody(html);
    const b = extractBody(html);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it("section_heading propagates to following blocks", () => {
    const html = `
      <html><body><main>
        <p>Intro paragraph before any heading appears in the document body.</p>
        <h2>Pricing details</h2>
        <p>Pricing varies by team size and required compliance certifications.</p>
        <h2>Implementation phases</h2>
        <p>Implementation runs in three phases to minimize operational risk.</p>
      </main></body></html>
    `;
    const { blocks } = extractBody(html);
    const intro = blocks.find((b) => b.text.startsWith("Intro paragraph"));
    const pricing = blocks.find((b) => b.text.startsWith("Pricing varies"));
    const impl = blocks.find((b) => b.text.startsWith("Implementation runs"));
    expect(intro?.section_heading).toBeNull();
    expect(pricing?.section_heading).toBe("Pricing details");
    expect(impl?.section_heading).toBe("Implementation phases");
  });
});
