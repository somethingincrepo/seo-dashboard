import type { CmsGuideTable } from "./types";

export const WEBFLOW_GUIDES: CmsGuideTable = {
  title_tag: {
    deliverable: "title_tag",
    platform: "webflow",
    title: "Update the title tag in Webflow",
    estimatedMinutes: 3,
    steps: [
      { text: "Log in to Webflow and open your project in the Designer." },
      { text: "In the left panel, click the Pages icon (looks like a document stack). Find the page that needs updating.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Hover over the page name and click the gear icon to open Page Settings." },
      { text: "Under the 'SEO Settings' section, clear the 'Title Tag' field and paste the new title:", copyable: { label: "New title tag", valueKey: "proposed_value" } },
      { text: "Click 'Save'. Then publish the site: click 'Publish' in the top right and publish to your live domain." },
      { text: "View-source the live page and confirm the <title> tag is updated." },
    ],
  },

  meta_description: {
    deliverable: "meta_description",
    platform: "webflow",
    title: "Update the meta description in Webflow",
    estimatedMinutes: 3,
    steps: [
      { text: "In the Webflow Designer, open Pages > gear icon for the target page.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Under 'SEO Settings', update the 'Meta Description' field:", copyable: { label: "New meta description", valueKey: "proposed_value" } },
      { text: "Click 'Save', then publish to your live domain.", warning: "For CMS collection pages (blog posts, etc.), the meta description is set per-item in the CMS editor, not in Page Settings." },
    ],
  },

  h1: {
    deliverable: "h1",
    platform: "webflow",
    title: "Update the H1 heading in Webflow",
    estimatedMinutes: 5,
    steps: [
      { text: "Open your project in the Webflow Designer and navigate to the page.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Click on the main heading element on the canvas. In the right panel (Style panel), confirm the 'Tag' dropdown (under the Element settings icon) says 'H1'." },
      { text: "Double-click the heading to enter edit mode. Select all the existing text and replace it:", copyable: { label: "New H1", valueKey: "proposed_value" } },
      { text: "Click outside the element to deselect. In the right panel, confirm the tag is still H1." },
      { text: "Publish to the live domain." },
      { text: "Inspect the live page and confirm only one H1 exists.", warning: "If the page is a CMS template, the H1 is usually bound to a CMS field. Update the CMS item instead (in Editor or CMS panel) rather than changing the template binding." },
    ],
  },

  internal_link_insertion: {
    deliverable: "internal_link_insertion",
    platform: "webflow",
    title: "Add an internal link in Webflow",
    estimatedMinutes: 6,
    steps: [
      { text: "Open the Designer and navigate to the source page.", copyable: { label: "Source page", valueKey: "page_url" } },
      { text: "Find the text element containing the source paragraph:", copyable: { label: "Source paragraph", valueKey: "source_paragraph_text" } },
      { text: "Double-click the text element to enter edit mode. Highlight the anchor text:", copyable: { label: "Anchor text", valueKey: "anchor_text" } },
      { text: "Click the link icon in the text toolbar (or press Cmd+K / Ctrl+K). Set the link type to 'URL' and paste the destination:", copyable: { label: "Link target", valueKey: "target_url" } },
      { text: "Press Enter to apply. Click outside to exit edit mode." },
      { text: "Publish to live." },
    ],
  },

  content_rewrite: {
    deliverable: "content_rewrite",
    platform: "webflow",
    title: "Apply the content rewrite in Webflow",
    estimatedMinutes: 10,
    steps: [
      { text: "Open the Designer and navigate to the page.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Find the text element with this content:", copyable: { label: "Find this text", valueKey: "current_value" } },
      { text: "Double-click the element to enter edit mode. Select all the text in the block and replace it:", copyable: { label: "Replace with", valueKey: "proposed_value" } },
      { text: "Click outside the element. Publish to live.", warning: "For CMS-bound text, you must update the content in the CMS item (Editor or CMS panel), not directly in the Designer -- the Designer shows the template, not the data." },
    ],
  },

  content_block_insert: {
    deliverable: "content_block_insert",
    platform: "webflow",
    title: "Insert a new content block in Webflow",
    estimatedMinutes: 8,
    steps: [
      { text: "Open the Designer and navigate to the page.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "In the left panel, open the Add Elements panel ('+' icon or press A). Drag a Paragraph or Heading element to the correct position on the canvas." },
      { text: "Double-click the new element and paste the content:", copyable: { label: "New content", valueKey: "proposed_value" } },
      { text: "Style the element to match surrounding content (use the Style panel on the right to set font, size, and spacing)." },
      { text: "Publish to live." },
    ],
  },

  full_article_publish: {
    deliverable: "full_article_publish",
    platform: "webflow",
    title: "Publish a new article in Webflow CMS",
    estimatedMinutes: 12,
    steps: [
      { text: "In the Webflow Designer, open the CMS panel (database icon in the left panel). Select your Blog (or Articles) collection." },
      { text: "Click 'New Item'." },
      { text: "Set the Name/Title field:", copyable: { label: "Post title", valueKey: "meta_title" } },
      { text: "Set the Slug field:", copyable: { label: "Slug", valueKey: "slug" } },
      { text: "Find the Rich Text body field and paste the article HTML. Webflow's Rich Text editor accepts pasted HTML -- use the HTML embed option if it doesn't render correctly:", copyable: { label: "Article HTML", valueKey: "html_body" } },
      { text: "Scroll to the SEO fields in the CMS item. Set the meta description:", copyable: { label: "Meta description", valueKey: "meta_description" } },
      { text: "Set the SEO title field to match the post title (if it is a separate field in your CMS schema)." },
      { text: "Toggle the item to 'Published'. Click 'Save & Publish'. Then publish the site to push the new item live." },
    ],
  },

  schema_org: {
    deliverable: "schema_org",
    platform: "webflow",
    title: "Add structured data (JSON-LD) in Webflow",
    estimatedMinutes: 7,
    steps: [
      { text: "In the Webflow Designer, open Pages > gear icon for the target page.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Scroll to the 'Custom Code' tab within Page Settings." },
      { text: "In the 'Head Code' area, paste the JSON-LD script tag:", copyable: { label: "JSON-LD", valueKey: "proposed_value" } },
      { text: "Click 'Save'. Publish to live." },
      { text: "Validate at https://search.google.com/test/rich-results.", warning: "For CMS collection pages, use the CMS item's custom code field if available, or add the script via an HTML Embed element inside the collection template." },
    ],
  },

  faq_schema: {
    deliverable: "faq_schema",
    platform: "webflow",
    title: "Add FAQ schema and visible FAQ section in Webflow",
    estimatedMinutes: 12,
    steps: [
      { text: "Open the page in the Webflow Designer.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Add visible FAQ content to the page using Heading and Paragraph elements (or an existing accordion component). The questions and answers must be visible to users." },
      { text: "Open Pages > gear icon > Custom Code > Head Code. Paste the FAQ JSON-LD:", copyable: { label: "FAQ JSON-LD", valueKey: "proposed_value" }, warning: "The questions and answers in the JSON-LD must exactly match what is visible on the page. Mismatches will cause Google to reject the schema." },
      { text: "Click 'Save'. Publish to live." },
      { text: "Validate at https://search.google.com/test/rich-results." },
    ],
  },

  location_signals: {
    deliverable: "location_signals",
    platform: "webflow",
    title: "Add local business structured data in Webflow",
    estimatedMinutes: 7,
    steps: [
      { text: "Open the homepage or location page in the Webflow Designer.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Go to Pages > gear icon > Custom Code > Head Code. Paste the LocalBusiness JSON-LD:", copyable: { label: "LocalBusiness JSON-LD", valueKey: "proposed_value" } },
      { text: "Verify the address, phone, and hours match your Google Business Profile exactly." },
      { text: "Click 'Save'. Publish to live." },
      { text: "Validate at https://search.google.com/test/rich-results." },
    ],
  },

  redirect: {
    deliverable: "redirect",
    platform: "webflow",
    title: "Set up a 301 redirect in Webflow",
    estimatedMinutes: 5,
    steps: [
      { text: "In the Webflow Designer, click the project settings icon (gear icon in the top left toolbar) to open Project Settings." },
      { text: "Go to the 'Hosting' tab. Scroll down to '301 Redirects'." },
      { text: "Click 'Add redirect'. In the 'Old path' field, enter the source path:", copyable: { label: "From path", valueKey: "current_value" } },
      { text: "In the 'New path' field, enter the destination:", copyable: { label: "To URL", valueKey: "proposed_value" } },
      { text: "Click the checkmark to save the row. Publish the site to make the redirect live." },
      { text: "Test in an incognito window by visiting the old path -- it should redirect to the destination." },
    ],
  },

  canonical: {
    deliverable: "canonical",
    platform: "webflow",
    title: "Set the canonical URL in Webflow",
    estimatedMinutes: 4,
    steps: [
      { text: "In the Webflow Designer, open Pages > gear icon for the target page.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Under 'SEO Settings', find the 'Canonical URL' field." },
      { text: "Paste the canonical URL:", copyable: { label: "Canonical URL", valueKey: "proposed_value" } },
      { text: "Click 'Save'. Publish to live." },
      { text: "View-source the page and search for 'canonical' to confirm the <link rel=\"canonical\"> tag is correct.", warning: "If the Canonical URL field is not visible in your Page Settings, your Webflow plan may not include it. In that case, add <link rel=\"canonical\" href=\"[URL]\"> manually in the Head Code section of Page Settings." },
    ],
  },

  alt_text: {
    deliverable: "alt_text",
    platform: "webflow",
    title: "Add alt text to an image in Webflow",
    estimatedMinutes: 3,
    steps: [
      { text: "Open the Designer and navigate to the page containing the image.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Click the image element on the canvas. In the right panel (Element settings), find the 'Alt Text' field." },
      { text: "Paste the alt text:", copyable: { label: "Alt text", valueKey: "proposed_value" } },
      { text: "Publish to live.", warning: "For images inside CMS collection templates, the alt text is typically bound to a CMS field. Update the alt text in the CMS item itself, not in the template binding." },
    ],
  },

  robots_txt: {
    deliverable: "robots_txt",
    platform: "webflow",
    title: "Update robots.txt in Webflow",
    estimatedMinutes: 5,
    steps: [
      { text: "In the Webflow Designer, open Project Settings (gear icon) > SEO tab." },
      { text: "Find the 'Robots.txt' text area." },
      { text: "Replace the content with:", copyable: { label: "robots.txt content", valueKey: "proposed_value" } },
      { text: "Click 'Save'. Publish the site to make the change live." },
      { text: "Visit yourdomain.com/robots.txt in an incognito window to confirm the content." },
    ],
  },

  sitemap_xml: {
    deliverable: "sitemap_xml",
    platform: "webflow",
    title: "Submit the Webflow sitemap to Google Search Console",
    estimatedMinutes: 4,
    steps: [
      { text: "Webflow automatically generates a sitemap at yourdomain.com/sitemap.xml when you publish. No manual update is needed." },
      { text: "To confirm: open Project Settings > SEO tab and verify 'Auto-generate sitemap' is enabled." },
      { text: "Go to https://search.google.com/search-console > Indexing > Sitemaps." },
      { text: "Enter yourdomain.com/sitemap.xml and click 'Submit'." },
    ],
  },

  indexation_submit: {
    deliverable: "indexation_submit",
    platform: "webflow",
    title: "Request indexation in Google Search Console",
    estimatedMinutes: 3,
    steps: [
      { text: "Go to https://search.google.com/search-console and select your property." },
      { text: "Paste the URL into the inspection bar at the top:", copyable: { label: "URL to submit", valueKey: "page_url" } },
      { text: "Click 'Test Live URL'. Confirm no crawl or rendering errors." },
      { text: "Click 'Request Indexing'.", warning: "Google limits this to roughly 10 URL requests per day per property." },
    ],
  },
};
