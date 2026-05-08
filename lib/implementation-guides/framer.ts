import type { CmsGuideTable } from "./types";

export const FRAMER_GUIDES: CmsGuideTable = {
  title_tag: {
    deliverable: "title_tag",
    platform: "framer",
    title: "Update the title tag in Framer",
    estimatedMinutes: 3,
    steps: [
      { text: "Open your project in Framer." },
      { text: "In the left panel, click the Pages icon. Click the page you want to edit to select it (do not double-click to enter it -- just select it in the panel).", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "In the right panel, look for the 'Page' tab. Under 'SEO', find the 'Title' field." },
      { text: "Clear the current value and paste the new title:", copyable: { label: "New title tag", valueKey: "proposed_value" } },
      { text: "Click 'Publish' in the top right and publish to your live domain." },
      { text: "View-source the live page and confirm the <title> tag is updated." },
    ],
  },

  meta_description: {
    deliverable: "meta_description",
    platform: "framer",
    title: "Update the meta description in Framer",
    estimatedMinutes: 3,
    steps: [
      { text: "Select the page in the Framer left panel (Pages icon).", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "In the right panel > Page tab > SEO section, find 'Description'." },
      { text: "Clear and paste:", copyable: { label: "New meta description", valueKey: "proposed_value" } },
      { text: "Publish to live.", warning: "For CMS collection pages, the meta description is set per-item in the CMS editor (Framer CMS tab), not in the page-level SEO settings." },
    ],
  },

  h1: {
    deliverable: "h1",
    platform: "framer",
    title: "Update the H1 heading in Framer",
    estimatedMinutes: 5,
    steps: [
      { text: "Open the page on the Framer canvas.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Click on the main heading element. In the right panel, look for the 'HTML Tag' or 'Tag' dropdown in the Properties section. Confirm it is set to 'h1'." },
      { text: "Double-click the heading on the canvas to enter edit mode. Select all text and replace it:", copyable: { label: "New H1", valueKey: "proposed_value" } },
      { text: "Click outside to exit edit mode." },
      { text: "Publish to live." },
      { text: "Inspect the live page and confirm only one H1 exists.", warning: "In Framer, text elements default to 'p' tag. Always verify the HTML Tag is explicitly set to 'h1' for the heading you are editing." },
    ],
  },

  internal_link_insertion: {
    deliverable: "internal_link_insertion",
    platform: "framer",
    title: "Add an internal link in Framer",
    estimatedMinutes: 6,
    steps: [
      { text: "Open the source page on the canvas.", copyable: { label: "Source page", valueKey: "page_url" } },
      { text: "Click the text layer containing the source paragraph:", copyable: { label: "Source paragraph", valueKey: "source_paragraph_text" } },
      { text: "Double-click to enter edit mode. Highlight the anchor text:", copyable: { label: "Anchor text", valueKey: "anchor_text" } },
      { text: "In the text toolbar that appears, click the link icon (chain link) or press Cmd+K / Ctrl+K. Paste the destination URL:", copyable: { label: "Link target", valueKey: "target_url" } },
      { text: "Press Enter to apply. Click outside to exit edit mode." },
      { text: "Publish to live." },
    ],
  },

  content_rewrite: {
    deliverable: "content_rewrite",
    platform: "framer",
    title: "Apply the content rewrite in Framer",
    estimatedMinutes: 10,
    steps: [
      { text: "Open the page on the Framer canvas.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Find the text element containing:", copyable: { label: "Find this text", valueKey: "current_value" } },
      { text: "Double-click to enter edit mode. Select all text in the element and replace it:", copyable: { label: "Replace with", valueKey: "proposed_value" } },
      { text: "Click outside to exit edit mode." },
      { text: "Publish to live.", warning: "For CMS-bound text layers, edit the content in the Framer CMS tab instead of directly on the canvas, as canvas changes to bound fields will not persist." },
    ],
  },

  content_block_insert: {
    deliverable: "content_block_insert",
    platform: "framer",
    title: "Insert a new content block in Framer",
    estimatedMinutes: 8,
    steps: [
      { text: "Open the page on the Framer canvas.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Press Ctrl+K (or Cmd+K) to open the Insert panel, or use the toolbar. Add a Text element at the desired position." },
      { text: "Double-click the new text element and paste the content:", copyable: { label: "New content", valueKey: "proposed_value" } },
      { text: "In the right panel, set the HTML Tag to the appropriate heading level or 'p' for paragraph." },
      { text: "Apply a text style from the right panel to match surrounding content." },
      { text: "Publish to live." },
    ],
  },

  full_article_publish: {
    deliverable: "full_article_publish",
    platform: "framer",
    title: "Publish a new article via Framer CMS",
    estimatedMinutes: 12,
    steps: [
      { text: "In Framer, open the CMS tab (database icon in the left panel). Select your blog or articles collection." },
      { text: "Click '+ New Item'." },
      { text: "Set the title field:", copyable: { label: "Post title", valueKey: "meta_title" } },
      { text: "Set the slug field:", copyable: { label: "Slug", valueKey: "slug" } },
      { text: "Find the body content field (usually a Rich Text field). Paste the article content. For HTML, use the source mode if available:", copyable: { label: "Article HTML", valueKey: "html_body" } },
      { text: "Find the SEO meta description field in the CMS item:", copyable: { label: "Meta description", valueKey: "meta_description" } },
      { text: "Set the featured image field if your collection has one." },
      { text: "Toggle the item to 'Published' and click 'Save'. Publish the site to push the new item live." },
    ],
  },

  schema_org: {
    deliverable: "schema_org",
    platform: "framer",
    title: "Add structured data (JSON-LD) in Framer",
    estimatedMinutes: 7,
    steps: [
      { text: "For a specific page: select the page in the left panel. In the right panel > Page tab, scroll to 'Custom Code' (under the SEO section or separately as a page-level code injection field). Paste the JSON-LD in the Head section:", copyable: { label: "JSON-LD", valueKey: "proposed_value" } },
      { text: "For site-wide schema: go to the Site icon (top left) > Settings > General > Custom Code > Head. Paste there instead." },
      { text: "Publish to live." },
      { text: "Validate at https://search.google.com/test/rich-results.", warning: "Per-page Custom Code is available in Framer on paid plans. On the free plan, only site-wide custom code is available." },
    ],
  },

  faq_schema: {
    deliverable: "faq_schema",
    platform: "framer",
    title: "Add FAQ schema and visible FAQ section in Framer",
    estimatedMinutes: 12,
    steps: [
      { text: "Open the page on the Framer canvas.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Add the visible FAQ content to the page. Use Text elements for questions (set to the appropriate heading level) and Text elements for answers. The content must be visible on the page." },
      { text: "Select the page in the left panel. In the right panel > Page > Custom Code > Head, paste the FAQ JSON-LD:", copyable: { label: "FAQ JSON-LD", valueKey: "proposed_value" }, warning: "The questions and answers in the JSON-LD must match what is visible on the page. Hidden or off-canvas content will cause Google to reject the schema." },
      { text: "Publish to live." },
      { text: "Validate at https://search.google.com/test/rich-results." },
    ],
  },

  location_signals: {
    deliverable: "location_signals",
    platform: "framer",
    title: "Add local business structured data in Framer",
    estimatedMinutes: 7,
    steps: [
      { text: "Go to Site icon (top left) > Settings > General > Custom Code > Head." },
      { text: "Paste the LocalBusiness JSON-LD:", copyable: { label: "LocalBusiness JSON-LD", valueKey: "proposed_value" } },
      { text: "Verify the address, phone, and hours match your Google Business Profile." },
      { text: "Publish to live." },
      { text: "Validate at https://search.google.com/test/rich-results." },
    ],
  },

  redirect: {
    deliverable: "redirect",
    platform: "framer",
    title: "Set up a 301 redirect in Framer",
    estimatedMinutes: 5,
    steps: [
      { text: "Go to Site icon (top left) > Settings > General > Redirects." },
      { text: "Click '+ Add Redirect'." },
      { text: "In the 'From' field, enter the old path:", copyable: { label: "From path", valueKey: "current_value" } },
      { text: "In the 'To' field, enter the destination:", copyable: { label: "To URL", valueKey: "proposed_value" } },
      { text: "Set the type to '301 Permanent'. Click 'Save'." },
      { text: "Publish the site. Test in an incognito window by visiting the old path." },
    ],
  },

  canonical: {
    deliverable: "canonical",
    platform: "framer",
    title: "Set the canonical URL in Framer",
    estimatedMinutes: 5,
    steps: [
      { text: "Select the page in the Framer left panel.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "In the right panel, look for the Page > SEO section. Some Framer versions show a 'Canonical URL' field directly here. If so, paste the canonical URL:", copyable: { label: "Canonical URL", valueKey: "proposed_value" } },
      { text: "If no canonical field is visible: go to Page > Custom Code > Head and manually paste: <link rel=\"canonical\" href=\"[canonical URL]\">" },
      { text: "Publish to live." },
      { text: "View-source the page and search for 'canonical' to confirm the tag is present.", warning: "Framer's canonical field was added in later versions. If your Framer version does not show it in the SEO panel, use the Custom Code head injection approach." },
    ],
  },

  alt_text: {
    deliverable: "alt_text",
    platform: "framer",
    title: "Add alt text to an image in Framer",
    estimatedMinutes: 3,
    steps: [
      { text: "Open the page on the canvas.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Click the image component on the canvas." },
      { text: "In the right panel, look for the 'Accessibility' section. Find the 'Alt' or 'Alt Text' field." },
      { text: "Paste the alt text:", copyable: { label: "Alt text", valueKey: "proposed_value" } },
      { text: "Publish to live.", warning: "For CMS images, the alt text is typically set per CMS item in the image field. Update the alt text in the CMS tab for the specific item." },
    ],
  },

  robots_txt: {
    deliverable: "robots_txt",
    platform: "framer",
    title: "Update robots.txt in Framer",
    estimatedMinutes: 5,
    steps: [
      { text: "Go to Site icon (top left) > Settings > SEO." },
      { text: "Find the 'Robots.txt' text area." },
      { text: "Replace the content with:", copyable: { label: "robots.txt content", valueKey: "proposed_value" } },
      { text: "Click 'Save'. Publish the site." },
      { text: "Visit yourdomain.com/robots.txt in an incognito window to confirm the content." },
    ],
  },

  sitemap_xml: {
    deliverable: "sitemap_xml",
    platform: "framer",
    title: "Submit the Framer sitemap to Google Search Console",
    estimatedMinutes: 4,
    steps: [
      { text: "Framer automatically generates a sitemap at yourdomain.com/sitemap.xml when you publish. No manual update is needed." },
      { text: "To confirm: go to Site Settings > SEO > Sitemap to view the sitemap configuration." },
      { text: "Go to https://search.google.com/search-console > Indexing > Sitemaps." },
      { text: "Enter yourdomain.com/sitemap.xml and click 'Submit'." },
    ],
  },

  indexation_submit: {
    deliverable: "indexation_submit",
    platform: "framer",
    title: "Request indexation in Google Search Console",
    estimatedMinutes: 3,
    steps: [
      { text: "Go to https://search.google.com/search-console and select your property." },
      { text: "Paste the URL into the inspection bar at the top:", copyable: { label: "URL to submit", valueKey: "page_url" } },
      { text: "Click 'Test Live URL'. Confirm no crawl errors." },
      { text: "Click 'Request Indexing'.", warning: "Google limits this to roughly 10 URL requests per day per property." },
    ],
  },
};
