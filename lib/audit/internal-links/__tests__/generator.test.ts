import { describe, it, expect } from "vitest";
import { generateProposals } from "../generator";
import { makePage } from "../../rules/__tests__/fixtures";
import type { LinkProposal } from "../types";

function fixedNow() { return new Date("2026-05-05T12:00:00.000Z"); }

const HTML_HOME = `<html><body><main>
  <h1>Acme — modern accounting for small teams</h1>
  <p>We help small business owners with bookkeeping services, payroll, and quarterly tax filings every season.</p>
  <h2>What we do</h2>
  <p>Our cloud bookkeeping platform pairs you with a dedicated accountant assigned to your account today.</p>
</main></body></html>`;

const HTML_BLOG_POST = `<html><body><main>
  <h1>Why payroll automation saves time</h1>
  <p>Manual payroll processing eats hours each pay period and introduces errors at the worst times.</p>
  <p>Modern cloud bookkeeping software replaces those spreadsheets with a single source of truth.</p>
  <h2>Getting started</h2>
  <p>Most teams move to automated payroll within two weeks of switching providers in our experience.</p>
</main></body></html>`;

const HTML_SERVICES = `<html><body><main>
  <h1>Bookkeeping services for small business owners</h1>
  <p>Our team supports founders, sole proprietors, and growing companies with monthly close support.</p>
</main></body></html>`;

describe("generateProposals", () => {
  it("R047: picks outbound links from a dead-end page using literal anchor text on the page", async () => {
    const home = makePage({
      id: "p-home",
      url: "https://acme.test/",
      page_type: "home",
      h1_text: "Acme",
      title: "Acme — Accounting",
      internal_links_out: 0,
      is_nav_page: true,
      word_count: 200,
    });
    const services = makePage({
      id: "p-services",
      url: "https://acme.test/services/",
      page_type: "category",
      h1_text: "Bookkeeping services",
      title: "Bookkeeping Services for Small Business | Acme",
      internal_links_in: 3,
      word_count: 400,
    });
    const blog = makePage({
      id: "p-blog",
      url: "https://acme.test/blog/payroll/",
      page_type: "article",
      h1_text: "Why payroll automation saves time",
      title: "Why Payroll Automation Saves Time | Acme",
      internal_links_in: 1,
      word_count: 800,
    });

    const out = await generateProposals({
      issues: [{ id: "issue-1", rule_id: "R047", page_id: "p-home", page_url: home.url }],
      pages: [home, services, blog],
      brand: "Acme",
      now: fixedNow,
      htmlByUrl: new Map([
        [home.url, HTML_HOME],
        [services.url, HTML_SERVICES],
        [blog.url, HTML_BLOG_POST],
      ]),
    });

    expect(out.failures).toEqual([]);
    expect(out.proposals.length).toBeGreaterThan(0);
    for (const { proposal } of out.proposals) {
      expect(proposal.source_url).toBe(home.url);
      // The anchor text must be a literal substring of the source paragraph,
      // case-insensitive — that's the deterministic "use existing text" rule.
      const text = proposal.source_paragraph_text.toLowerCase();
      expect(text).toContain(proposal.anchor_text);
      expect(proposal.source_paragraph_text.slice(proposal.anchor_text_start, proposal.anchor_text_end).toLowerCase())
        .toBe(proposal.anchor_text);
      expect(proposal.version).toBe(1);
      expect(proposal.rule_id).toBe("R047");
    }
  });

  it("R048: picks an inbound source page that already mentions the orphan target's h1", async () => {
    const orphan = makePage({
      id: "p-services",
      url: "https://acme.test/services/",
      page_type: "category",
      h1_text: "Bookkeeping services",
      title: "Bookkeeping services | Acme",
      internal_links_in: 0,
      word_count: 400,
      headings: [{ level: 1, text: "Bookkeeping services" }, { level: 2, text: "Pricing" }],
    });
    const blog = makePage({
      id: "p-blog",
      url: "https://acme.test/blog/payroll/",
      page_type: "article",
      h1_text: "Why payroll automation saves time",
      title: "Why payroll automation saves time | Acme",
      internal_links_in: 5,
      internal_links_out: 4,
      word_count: 800,
    });
    const home = makePage({
      id: "p-home",
      url: "https://acme.test/",
      page_type: "home",
      h1_text: "Acme",
      title: "Acme",
      internal_links_in: 20,
      internal_links_out: 12,
      is_nav_page: true,
      word_count: 250,
    });

    const blogHtml = `<html><body><main>
      <h1>Why payroll automation saves time</h1>
      <p>Modern bookkeeping services replace spreadsheets and free founders to focus on customers.</p>
    </main></body></html>`;

    const out = await generateProposals({
      issues: [{ id: "issue-2", rule_id: "R048", page_id: "p-services", page_url: orphan.url }],
      pages: [home, orphan, blog],
      brand: "Acme",
      now: fixedNow,
      htmlByUrl: new Map([
        [blog.url, blogHtml],
        [home.url, HTML_HOME],
      ]),
    });

    expect(out.proposals.length).toBe(1);
    const p = out.proposals[0].proposal as LinkProposal;
    expect(p.target_url).toBe(orphan.url);
    expect(p.anchor_text).toBe("bookkeeping services");
  });

  it("returns identical output for identical inputs (determinism check)", async () => {
    const home = makePage({
      id: "p-home", url: "https://acme.test/", page_type: "home",
      h1_text: "Acme", internal_links_out: 0, word_count: 200,
    });
    const services = makePage({
      id: "p-services", url: "https://acme.test/services/", page_type: "category",
      h1_text: "Bookkeeping services", title: "Bookkeeping Services for Small Business | Acme",
      internal_links_in: 3, word_count: 400,
    });
    const htmlByUrl = new Map([
      [home.url, HTML_HOME],
      [services.url, HTML_SERVICES],
    ]);
    const args = {
      issues: [{ id: "issue-1", rule_id: "R047", page_id: "p-home", page_url: home.url }],
      pages: [home, services],
      brand: "Acme",
      now: fixedNow,
      htmlByUrl,
    };
    const a = await generateProposals(args);
    const b = await generateProposals(args);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("returns a failure (not a fabricated proposal) when no anchor candidate matches", async () => {
    const orphan = makePage({
      id: "p-x", url: "https://acme.test/x/",
      h1_text: "Quantum widget exchange protocols",
      title: "Quantum widget exchange protocols",
      internal_links_in: 0,
    });
    const blog = makePage({
      id: "p-blog", url: "https://acme.test/blog/cooking/",
      h1_text: "Cooking with cast iron",
      title: "Cooking with cast iron",
      internal_links_in: 5, word_count: 800, page_type: "article",
    });
    const out = await generateProposals({
      issues: [{ id: "issue-3", rule_id: "R048", page_id: "p-x", page_url: orphan.url }],
      pages: [orphan, blog],
      now: fixedNow,
      htmlByUrl: new Map([
        [blog.url, `<html><body><main><p>Cast iron pans are remarkable for searing steaks evenly all the way through.</p></main></body></html>`],
      ]),
    });
    expect(out.proposals).toHaveLength(0);
    expect(out.failures).toHaveLength(1);
    expect(out.failures[0].issue_id).toBe("issue-3");
  });
});
