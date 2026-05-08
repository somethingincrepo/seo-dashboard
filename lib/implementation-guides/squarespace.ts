import type { CmsGuideTable } from "./types";

export const SQUARESPACE_GUIDES: CmsGuideTable = {
  title_tag: {
    deliverable: "title_tag",
    platform: "squarespace",
    title: "Update the title tag in Squarespace",
    estimatedMinutes: 3,
    steps: [
      { text: "Log in to your Squarespace dashboard and go to Pages in the left panel." },
      { text: "Hover over the page you want to edit and click the gear icon (or three dots > Settings) to open page settings.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Click the 'SEO' tab." },
      { text: "Find the 'SEO Title' field. Clear it and paste the new title:", copyable: { label: "New title tag", valueKey: "proposed_value" } },
      { text: "Click 'Save'. Changes are live immediately -- no separate publish step is needed on Squarespace." },
      { text: "View-source the page and confirm the <title> tag is updated." },
    ],
  },

  meta_description: {
    deliverable: "meta_description",
    platform: "squarespace",
    title: "Update the meta description in Squarespace",
    estimatedMinutes: 3,
    steps: [
      { text: "Go to Pages > hover the page > gear icon > SEO tab.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Find 'SEO Description'. Clear it and paste:", copyable: { label: "New meta description", valueKey: "proposed_value" } },
      { text: "Click 'Save'." },
    ],
  },

  h1: {
    deliverable: "h1",
    platform: "squarespace",
    title: "Update the H1 heading in Squarespace",
    estimatedMinutes: 5,
    steps: [
      { text: "Open the page in the Squarespace editor (click 'Edit' on the page).", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Click on the main heading text at the top of the page to select the text block." },
      { text: "Select all the existing heading text and replace it:", copyable: { label: "New H1", valueKey: "proposed_value" } },
      { text: "In the text block toolbar, confirm the text style is set to 'Heading 1'. If not, select it from the paragraph style dropdown." },
      { text: "Click outside the block to deselect, then click 'Save' or 'Done' in the top bar.", warning: "Some Squarespace themes render the page name (from Pages settings) as the H1 in the page header, separate from the first content block heading. If so, update the page name via Pages > gear icon > General tab > Page Title." },
    ],
  },

  internal_link_insertion: {
    deliverable: "internal_link_insertion",
    platform: "squarespace",
    title: "Add an internal link in Squarespace",
    estimatedMinutes: 5,
    steps: [
      { text: "Open the source page in the Squarespace editor.", copyable: { label: "Source page", valueKey: "page_url" } },
      { text: "Click the text block containing the paragraph:", copyable: { label: "Source paragraph", valueKey: "source_paragraph_text" } },
      { text: "Highlight the anchor text:", copyable: { label: "Anchor text", valueKey: "anchor_text" } },
      { text: "In the text toolbar that appears, click the link icon (chain link). Paste the destination URL:", copyable: { label: "Link target", valueKey: "target_url" } },
      { text: "Click 'Apply'. Save the page." },
    ],
  },

  content_rewrite: {
    deliverable: "content_rewrite",
    platform: "squarespace",
    title: "Apply the content rewrite in Squarespace",
    estimatedMinutes: 10,
    steps: [
      { text: "Open the page in the Squarespace editor.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Click the text block with the existing content:" , copyable: { label: "Find this text", valueKey: "current_value" } },
      { text: "Select and delete the existing text. Paste the replacement:", copyable: { label: "Replace with", valueKey: "proposed_value" } },
      { text: "Save the page." },
    ],
  },

  content_block_insert: {
    deliverable: "content_block_insert",
    platform: "squarespace",
    title: "Insert a new content block in Squarespace",
    estimatedMinutes: 6,
    steps: [
      { text: "Open the page in the Squarespace editor.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Click the '+' button that appears when hovering between content sections or at the position where the new block should go." },
      { text: "Select 'Text' from the block menu." },
      { text: "Click into the new text block and paste the content:", copyable: { label: "New content", valueKey: "proposed_value" } },
      { text: "Save the page." },
    ],
  },

  full_article_publish: {
    deliverable: "full_article_publish",
    platform: "squarespace",
    title: "Publish the new blog post in Squarespace",
    estimatedMinutes: 12,
    steps: [
      { text: "In the Squarespace left panel, click on your Blog page. Click the '+' button to create a new blog post." },
      { text: "Set the post title:", copyable: { label: "Post title", valueKey: "meta_title" } },
      { text: "Click into the body area. To paste HTML, click the '+' block inserter > 'Code' block. Paste the article HTML in the Code block set to HTML mode.", copyable: { label: "Article HTML", valueKey: "html_body" }, warning: "Squarespace's built-in blog editor is a rich text editor, not an HTML editor. Use a Code block if you have raw HTML. Alternatively, copy the content as plain text and reformat using the editor's built-in heading/paragraph styles." },
      { text: "Click the gear icon on the new post to open its settings. Set the URL slug:", copyable: { label: "Slug", valueKey: "slug" } },
      { text: "Go to the SEO tab in the post settings. Set the SEO title and description:", copyable: { label: "Meta description", valueKey: "meta_description" } },
      { text: "Add a featured image via the 'Thumbnail' option in the post settings." },
      { text: "Set the post status to 'Published' and click 'Save'." },
    ],
  },

  schema_org: {
    deliverable: "schema_org",
    platform: "squarespace",
    title: "Add structured data (JSON-LD) in Squarespace",
    estimatedMinutes: 8,
    steps: [
      { text: "For a specific page: open the page in the Squarespace editor. Click the '+' block inserter > 'Code'. Change the mode to 'HTML' and paste the JSON-LD script tag:", copyable: { label: "JSON-LD", valueKey: "proposed_value" } },
      { text: "Alternatively, for site-wide injection: go to Settings > Advanced > Code Injection > Header. Paste the JSON-LD there. This will appear on every page -- only use this method for site-wide schema like Organization or LocalBusiness." },
      { text: "Save the page or settings." },
      { text: "Validate at https://search.google.com/test/rich-results.", warning: "Squarespace's per-page Code Injection (via the page settings > Advanced > Code Injection) is only available on Business plan and higher. On Personal plan, use the Code block approach within the page editor instead." },
    ],
  },

  faq_schema: {
    deliverable: "faq_schema",
    platform: "squarespace",
    title: "Add FAQ schema and visible FAQ section in Squarespace",
    estimatedMinutes: 12,
    steps: [
      { text: "Open the page in the Squarespace editor.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Add the visible FAQ content. Use an Accordion block (available in Squarespace 7.1) or add Heading + Text blocks for each question and answer pair. The content must be visible on the page." },
      { text: "Add a Code block below the FAQ content. Set to HTML mode and paste the FAQ JSON-LD:", copyable: { label: "FAQ JSON-LD", valueKey: "proposed_value" }, warning: "FAQ schema requires the questions and answers to be visible to users on the page. Hidden, collapsed (CSS display:none), or dynamically loaded content will be rejected by Google." },
      { text: "Save the page." },
      { text: "Validate at https://search.google.com/test/rich-results." },
    ],
  },

  location_signals: {
    deliverable: "location_signals",
    platform: "squarespace",
    title: "Add local business structured data in Squarespace",
    estimatedMinutes: 8,
    steps: [
      { text: "Go to Settings > Advanced > Code Injection." },
      { text: "Paste the LocalBusiness JSON-LD in the 'Header' field:", copyable: { label: "LocalBusiness JSON-LD", valueKey: "proposed_value" } },
      { text: "Verify the address, phone, and hours match your Google Business Profile." },
      { text: "Click 'Save'." },
      { text: "Validate at https://search.google.com/test/rich-results.", warning: "Code Injection is only available on Business plan and above. On Personal plan, add the JSON-LD via a Code block directly on the page instead." },
    ],
  },

  redirect: {
    deliverable: "redirect",
    platform: "squarespace",
    title: "Set up a 301 redirect in Squarespace",
    estimatedMinutes: 5,
    steps: [
      { text: "Go to Settings > Advanced > URL Mappings." },
      { text: "Add a new line in the URL mappings text area using this format:" },
      { text: "/old-path -> /new-destination 301", copyable: { label: "From path", valueKey: "current_value" } },
      { text: "The full entry should look like: [old path] -> [destination] 301", copyable: { label: "Destination", valueKey: "proposed_value" } },
      { text: "Click 'Save'.", warning: "Squarespace URL Mappings support basic 301 and 302 redirects for paths within your domain. Full external URLs in the source are not supported -- use the path only (starting with /)." },
      { text: "Test in an incognito window by visiting the old path." },
    ],
  },

  canonical: {
    deliverable: "canonical",
    platform: "squarespace",
    title: "Set a canonical URL in Squarespace",
    estimatedMinutes: 8,
    steps: [
      { text: "Squarespace does not have a per-page canonical URL field in the standard admin UI. To add one, you must inject the tag manually.", warning: "Per-page canonical injection requires the Business plan or higher (for per-page Code Injection) or the use of a Code block on the page." },
      { text: "Option 1 (Business plan and above): go to Pages > hover the page > gear icon > Advanced tab. In the 'Page Header Code Injection' field, paste:", copyable: { label: "Canonical URL", valueKey: "proposed_value" } },
      { text: "The injected code should be: <link rel=\"canonical\" href=\"[canonical URL]\">" },
      { text: "Option 2 (any plan): add a Code block to the page, set it to HTML, and paste the same <link rel=\"canonical\"> tag. Note that this places it in the body, not the head, which is technically non-standard but works for most crawlers." },
      { text: "Click 'Save'. View-source the page to confirm the canonical tag is present." },
    ],
  },

  alt_text: {
    deliverable: "alt_text",
    platform: "squarespace",
    title: "Add alt text to an image in Squarespace",
    estimatedMinutes: 3,
    steps: [
      { text: "Open the page in the Squarespace editor.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Click on the image to select it. In the image block settings panel that appears, click the pencil/edit icon." },
      { text: "Find the 'Alt text' or 'Alternative text' field and paste:", copyable: { label: "Alt text", valueKey: "proposed_value" } },
      { text: "Click 'Apply' or 'Save'." },
    ],
  },

  robots_txt: {
    deliverable: "robots_txt",
    platform: "squarespace",
    title: "Update robots.txt in Squarespace",
    estimatedMinutes: 5,
    steps: [
      { text: "Go to Settings > Advanced > External API Keys. Scroll down to find the 'Robots.txt' section.", warning: "Squarespace has limited robots.txt customization. On most plans, you can add Disallow rules but cannot replace the entire file. The Squarespace-generated defaults are preserved." },
      { text: "Add or modify the robots.txt directives as recommended:", copyable: { label: "robots.txt directives", valueKey: "proposed_value" } },
      { text: "Click 'Save'." },
      { text: "Visit yourdomain.com/robots.txt in an incognito window to confirm the updated content." },
    ],
  },

  sitemap_xml: {
    deliverable: "sitemap_xml",
    platform: "squarespace",
    title: "Submit the Squarespace sitemap to Google Search Console",
    estimatedMinutes: 4,
    steps: [
      { text: "Squarespace automatically generates a sitemap at yourdomain.com/sitemap.xml. No manual update is needed." },
      { text: "Go to https://search.google.com/search-console > Indexing > Sitemaps." },
      { text: "Enter yourdomain.com/sitemap.xml and click 'Submit'." },
      { text: "Squarespace also generates per-page type sitemaps (e.g., /blog-sitemap.xml). You can submit these individually as well." },
    ],
  },

  indexation_submit: {
    deliverable: "indexation_submit",
    platform: "squarespace",
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
