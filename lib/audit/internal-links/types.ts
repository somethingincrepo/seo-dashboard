/**
 * Shared types for the deterministic internal-link generator.
 *
 * The proposed_value column on issues stores a serialized LinkProposal v1.
 * The portal and admin UI parse this JSON to render the suggestion. Because
 * all fields are derived deterministically from the live source page HTML,
 * the user can verify the proposal against the page before approving — there
 * is no LLM-rewritten text in the proposal at all.
 */

export interface LinkProposal {
  /** Schema version. Bump if the shape changes in a non-additive way. */
  version: 1;

  /** Audit rule that motivated the proposal (R047 | R048 | R049 | R050). */
  rule_id: string;

  /** Full URL of the page that will be edited. */
  source_url: string;
  /** Full URL of the page being linked to. */
  target_url: string;

  /** Lowercased phrase used for matching. */
  anchor_text: string;
  /** The phrase exactly as it appears on the source page (preserves case + punctuation). */
  anchor_text_display: string;

  /** Heading text of the section the link will sit in (h2/h3 nearest above). */
  source_section_heading: string | null;
  /** Block tag the link sits in (p, li, h2, etc.). */
  source_block_tag: "p" | "h2" | "h3" | "h4" | "li";
  /** Zero-based block index, useful for ordering multiple proposals against the same source. */
  source_block_index: number;

  /** Plain-text paragraph as it appears on the page (entities decoded, whitespace collapsed). */
  source_paragraph_text: string;
  /** Original HTML for the same paragraph, copied verbatim from the live page. */
  source_paragraph_html: string;

  /** Char offsets of the anchor span inside `source_paragraph_text`. */
  anchor_text_start: number;
  anchor_text_end: number;
  /** Char offsets of the anchor span inside `source_paragraph_html`. */
  anchor_html_start: number;
  anchor_html_end: number;

  /** Where the matched phrase came from on the target page. */
  phrase_source: "h1" | "title" | "h2" | "h3" | "keyword";

  /** Deterministic score components. The portal can render these as the rationale. */
  score_components: {
    phrase_priority: number;
    page_type_fit: number;
    authority: number;
    dilution_penalty: number;
    position: number;
  };

  /** A short human-readable explanation derived from the score components — never LLM-written. */
  rationale: string;

  /** Confidence bucket derived from score components. */
  confidence: "High" | "Medium" | "Low";

  /** ISO timestamp of when the proposal was generated. */
  generated_at: string;
}
