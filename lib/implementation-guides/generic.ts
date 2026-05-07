import type { DeliverableType, GuideEntry } from "./types";

export const genericGuides: Record<DeliverableType, GuideEntry> = {
  title_tag: {
    deliverable: "title_tag",
    platform: "generic",
    title: "Update the title tag",
    estimatedMinutes: 5,
    steps: [
      {
        text: 'Log in to your CMS and open the page at {{page_url}}.',
      },
      {
        text: 'Find the SEO or metadata settings for this page. This is often labeled "SEO title", "Page title", or found under a search/social tab.',
      },
      {
        text: 'Replace the current title with the proposed value.',
        copyable: { label: "Proposed title", valueKey: "proposed_value" },
      },
      {
        text: "Save or publish the page.",
        warning: "Changes may take a few days to appear in Google search results after the page is re-crawled.",
      },
    ],
  },

  meta_description: {
    deliverable: "meta_description",
    platform: "generic",
    title: "Update the meta description",
    estimatedMinutes: 5,
    steps: [
      {
        text: 'Log in to your CMS and open the page at {{page_url}}.',
      },
      {
        text: 'Find the SEO or metadata settings. Look for a field labeled "Meta description" or "Search description".',
      },
      {
        text: "Replace the current description with the proposed value.",
        copyable: { label: "Proposed description", valueKey: "proposed_value" },
      },
      {
        text: "Save or publish the page.",
      },
    ],
  },

  h1: {
    deliverable: "h1",
    platform: "generic",
    title: "Update the H1 heading",
    estimatedMinutes: 5,
    steps: [
      {
        text: 'Log in to your CMS and open the page at {{page_url}} for editing.',
      },
      {
        text: 'Find the main page heading. It is typically the first large heading at the top of the page body, marked as "Heading 1" or "H1" in your editor.',
      },
      {
        text: "Replace the current heading text with the proposed value.",
        copyable: { label: "Proposed H1", valueKey: "proposed_value" },
      },
      {
        text: "Save or publish the page.",
        warning: "There should be exactly one H1 on the page. If you see multiple, remove the extras.",
      },
    ],
  },

  internal_link_insertion: {
    deliverable: "internal_link_insertion",
    platform: "generic",
    title: "Insert internal link",
    estimatedMinutes: 10,
    steps: [
      {
        text: 'Log in to your CMS and open the page at {{page_url}} for editing.',
      },
      {
        text: "Locate the anchor text or section identified in the recommendation.",
        copyable: { label: "Anchor text / context", valueKey: "proposed_value" },
      },
      {
        text: "Highlight the anchor text and add a hyperlink pointing to the destination URL listed in the recommendation.",
      },
      {
        text: "Save or publish the page.",
      },
    ],
  },

  content_rewrite: {
    deliverable: "content_rewrite",
    platform: "generic",
    title: "Publish content rewrite",
    estimatedMinutes: 15,
    prerequisites: ["Review the updated draft in the Content Refreshes tab before publishing."],
    steps: [
      {
        text: 'Open the page at {{page_url}} in your CMS.',
      },
      {
        text: "Replace the existing body content with the updated draft provided in the portal.",
        warning: "Copy the full draft including headings, body paragraphs, and any lists. Do not mix old and new content.",
      },
      {
        text: "Confirm the title tag and meta description are still correct after the update.",
      },
      {
        text: "Save and publish the page.",
      },
    ],
  },

  content_block_insert: {
    deliverable: "content_block_insert",
    platform: "generic",
    title: "Insert content block",
    estimatedMinutes: 10,
    steps: [
      {
        text: 'Open the page at {{page_url}} in your CMS editor.',
      },
      {
        text: "Navigate to the position specified in the recommendation (typically after the intro or before the conclusion).",
      },
      {
        text: "Insert the provided content block, preserving its heading level and formatting.",
        copyable: { label: "Content to insert", valueKey: "proposed_value" },
      },
      {
        text: "Save or publish the page.",
      },
    ],
  },

  full_article_publish: {
    deliverable: "full_article_publish",
    platform: "generic",
    title: "Publish new article",
    estimatedMinutes: 15,
    prerequisites: ["Article draft has been reviewed and approved in the portal."],
    steps: [
      {
        text: "Log in to your CMS and create a new blog post or article.",
      },
      {
        text: "Set the title to the approved title.",
        copyable: { label: "Article title", valueKey: "proposed_value" },
      },
      {
        text: "Paste the full article content from the portal into the body editor. Preserve all headings (H2/H3), paragraphs, and any lists.",
      },
      {
        text: "Set the meta title and meta description using the values provided in the portal.",
      },
      {
        text: "Set the URL slug as specified. Avoid auto-generated slugs if they differ from the recommendation.",
      },
      {
        text: "Set the publication date to today and publish.",
        warning: "Do not publish until you have reviewed the draft in full and confirmed the title, URL, and meta fields.",
      },
    ],
  },

  schema_org: {
    deliverable: "schema_org",
    platform: "generic",
    title: "Add Organization / schema markup",
    estimatedMinutes: 15,
    steps: [
      {
        text: "Navigate to the global head or custom code section of your CMS. This is typically in Settings > Custom Code, Site Settings, or a theme options panel.",
      },
      {
        text: "Paste the provided JSON-LD script block into the head section.",
        copyable: { label: "Schema JSON-LD", valueKey: "proposed_value" },
        warning: "Place this in the <head> of the page or site-wide. Do not put it inside the body content area.",
      },
      {
        text: "Save and publish.",
      },
      {
        text: "Verify using Google's Rich Results Test by pasting your URL after publishing.",
      },
    ],
  },

  faq_schema: {
    deliverable: "faq_schema",
    platform: "generic",
    title: "Add FAQ schema markup",
    estimatedMinutes: 10,
    steps: [
      {
        text: 'Open the page at {{page_url}} in your CMS.',
      },
      {
        text: "Navigate to the custom code or head injection section for this specific page (not site-wide).",
      },
      {
        text: "Paste the provided FAQ JSON-LD script block.",
        copyable: { label: "FAQ schema JSON-LD", valueKey: "proposed_value" },
      },
      {
        text: "Save and publish the page.",
      },
      {
        text: "Verify using Google's Rich Results Test at search.google.com/test/rich-results.",
      },
    ],
  },

  location_signals: {
    deliverable: "location_signals",
    platform: "generic",
    title: "Add location signals",
    estimatedMinutes: 10,
    steps: [
      {
        text: 'Open the page at {{page_url}} in your CMS editor.',
      },
      {
        text: "Locate the section identified in the recommendation (typically a services list, about section, or footer area).",
      },
      {
        text: "Insert the provided location text naturally into the content.",
        copyable: { label: "Location text to add", valueKey: "proposed_value" },
      },
      {
        text: "Save or publish the page.",
      },
    ],
  },

  redirect: {
    deliverable: "redirect",
    platform: "generic",
    title: "Set up 301 redirect",
    estimatedMinutes: 10,
    steps: [
      {
        text: "Find the redirect management section in your CMS or hosting provider. This is commonly labeled Redirects, URL Redirects, or found in your site settings.",
      },
      {
        text: "Create a new redirect with the following settings: Type 301 (permanent), From path set to the old URL, To path set to the destination URL.",
        copyable: { label: "Redirect rule", valueKey: "proposed_value" },
        warning: "Use 301 (permanent) not 302 (temporary). A 302 does not pass SEO value to the destination.",
      },
      {
        text: "Save the redirect and test it by visiting the old URL in your browser to confirm it forwards correctly.",
      },
    ],
  },

  canonical: {
    deliverable: "canonical",
    platform: "generic",
    title: "Set canonical URL",
    estimatedMinutes: 5,
    steps: [
      {
        text: 'Open the page at {{page_url}} in your CMS.',
      },
      {
        text: 'Find the canonical URL field. This is typically in the SEO settings for the page, labeled "Canonical URL" or "Canonical link".',
      },
      {
        text: "Enter the canonical URL as specified in the recommendation.",
        copyable: { label: "Canonical URL", valueKey: "proposed_value" },
      },
      {
        text: "Save or publish the page.",
      },
    ],
  },

  alt_text: {
    deliverable: "alt_text",
    platform: "generic",
    title: "Update image alt text",
    estimatedMinutes: 5,
    steps: [
      {
        text: 'Open the page at {{page_url}} in your CMS editor.',
      },
      {
        text: "Click the image identified in the recommendation to open its settings panel.",
      },
      {
        text: 'Find the field labeled "Alt text", "Alternative text", or "Image description".',
      },
      {
        text: "Enter the proposed alt text.",
        copyable: { label: "Alt text", valueKey: "proposed_value" },
      },
      {
        text: "Save or publish the page.",
      },
    ],
  },

  robots_txt: {
    deliverable: "robots_txt",
    platform: "generic",
    title: "Update robots.txt",
    estimatedMinutes: 10,
    prerequisites: ["Back up the current robots.txt before making changes."],
    steps: [
      {
        text: "Locate your robots.txt file. On most platforms this is under Settings > SEO or accessible at yourdomain.com/robots.txt. Some CMS platforms have a built-in editor.",
      },
      {
        text: "Apply the change specified in the recommendation.",
        copyable: { label: "Proposed robots.txt update", valueKey: "proposed_value" },
        warning: "Incorrect robots.txt entries can accidentally block search engines from your entire site. Double-check any Disallow rules before saving.",
      },
      {
        text: "Save and verify at yourdomain.com/robots.txt that the change is live.",
      },
      {
        text: "Submit the robots.txt URL in Google Search Console under Settings > robots.txt if prompted.",
      },
    ],
  },

  sitemap_xml: {
    deliverable: "sitemap_xml",
    platform: "generic",
    title: "Update or regenerate sitemap",
    estimatedMinutes: 10,
    steps: [
      {
        text: "Most CMS platforms generate sitemaps automatically. Check if your platform has a sitemap setting under SEO or Site Settings.",
      },
      {
        text: "Apply the change described in the recommendation. This may mean enabling the sitemap, excluding specific pages, or forcing a regeneration.",
        copyable: { label: "Recommendation", valueKey: "proposed_value" },
      },
      {
        text: "Confirm the sitemap is accessible at yourdomain.com/sitemap.xml.",
      },
      {
        text: "Submit the sitemap URL in Google Search Console under Sitemaps to ensure Google picks up the update promptly.",
      },
    ],
  },

  indexation_submit: {
    deliverable: "indexation_submit",
    platform: "generic",
    title: "Submit URL for indexing",
    estimatedMinutes: 5,
    steps: [
      {
        text: "Go to Google Search Console (search.google.com/search-console) and select your property.",
      },
      {
        text: 'Paste the page URL into the URL Inspection tool at the top of the page.',
        copyable: { label: "Page URL", valueKey: "page_url" },
      },
      {
        text: 'Once the inspection loads, click "Request Indexing".',
      },
      {
        text: "Google typically processes indexing requests within a few days. You can revisit URL Inspection to check the current index status.",
      },
    ],
  },
};
