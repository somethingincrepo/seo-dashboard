import type { CmsGuideTable } from "./types";

export const WORDPRESS_YOAST_GUIDES: CmsGuideTable = {
  title_tag: {
    deliverable: "title_tag",
    platform: "wordpress_self",
    variant: "yoast",
    title: "Update the title tag with Yoast SEO",
    estimatedMinutes: 3,
    prerequisites: ["Yoast SEO plugin installed and active"],
    steps: [
      { text: "Log in to your WordPress admin and go to Pages or Posts." },
      { text: "Open the page at this URL.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Scroll down past the editor to the Yoast SEO box. Click 'Edit snippet' if the preview is collapsed." },
      { text: "Click into the 'SEO title' field. Clear any existing content, then type or paste the new title below. The progress bar should turn green (50-60 chars ideal).", copyable: { label: "New title tag", valueKey: "proposed_value" } },
      { text: "Click 'Update' or 'Publish' in the top right." },
      { text: "Open an incognito tab, visit the page, and use View Source (Ctrl+U) to confirm the <title> tag matches." },
    ],
  },

  meta_description: {
    deliverable: "meta_description",
    platform: "wordpress_self",
    variant: "yoast",
    title: "Update the meta description with Yoast SEO",
    estimatedMinutes: 3,
    prerequisites: ["Yoast SEO plugin installed and active"],
    steps: [
      { text: "Open the page or post in the WordPress editor.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Scroll to the Yoast SEO box below the editor. Click 'Edit snippet'." },
      { text: "Click into the 'Meta description' field. Paste the new description.", copyable: { label: "New meta description", valueKey: "proposed_value" } },
      { text: "The character-count bar should sit comfortably in the green range (120-156 chars). If Yoast shows a warning about length, that is expected for some approved descriptions." },
      { text: "Click 'Update' or 'Publish'.", warning: "If the old description still appears in Google results after a few days, go to Yoast > Tools > File Editor and confirm no redirect or caching plugin is serving a stale version." },
    ],
  },

  h1: {
    deliverable: "h1",
    platform: "wordpress_self",
    variant: "yoast",
    title: "Update the H1 heading",
    estimatedMinutes: 4,
    steps: [
      { text: "Open the page or post in the WordPress block editor.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "The page title field at the very top of the editor (labeled 'Add title') renders as the H1 on most themes. Update it to the new value below.", copyable: { label: "New H1", valueKey: "proposed_value" } },
      { text: "If the page uses a separate Heading block for the H1 (some custom templates do), click that block, confirm the block type says 'Heading' and the level is H1 in the right panel, then edit the text there instead." },
      { text: "Click 'Update'." },
      { text: "View the live page and right-click > 'Inspect' to confirm only one H1 tag exists on the page.", warning: "Some page builders (Elementor, Divi) may render the title differently. If the Heading block approach doesn't affect the visible H1, check the builder's own heading settings." },
    ],
  },

  internal_link_insertion: {
    deliverable: "internal_link_insertion",
    platform: "wordpress_self",
    variant: "yoast",
    title: "Add an internal link",
    estimatedMinutes: 5,
    steps: [
      { text: "Open the source page in the WordPress block editor.", copyable: { label: "Source page", valueKey: "page_url" } },
      { text: "Find the paragraph block containing this text:", copyable: { label: "Source paragraph", valueKey: "source_paragraph_text" } },
      { text: "Click the paragraph block to select it, then highlight this anchor text within it:", copyable: { label: "Anchor text", valueKey: "anchor_text" } },
      { text: "Press Ctrl+K (Windows) or Cmd+K (Mac) to open the link popover. Paste the destination URL:", copyable: { label: "Link target", valueKey: "target_url" } },
      { text: "Press Enter to apply the link. Click 'Update'." },
    ],
  },

  content_rewrite: {
    deliverable: "content_rewrite",
    platform: "wordpress_self",
    variant: "yoast",
    title: "Apply the content rewrite",
    estimatedMinutes: 10,
    steps: [
      { text: "Open the page in the WordPress block editor.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Use Ctrl+F (or Cmd+F on Mac) or the block editor's search (Options menu > Find and Replace) to locate the section to replace. The existing text is:", copyable: { label: "Find this text", valueKey: "current_value" } },
      { text: "Click the paragraph or heading block containing that text. Select all text in the block and replace it with:", copyable: { label: "Replace with", valueKey: "proposed_value" } },
      { text: "Check that surrounding formatting (font size, spacing, no extra line breaks) looks consistent with the rest of the page." },
      { text: "Click 'Update'." },
    ],
  },

  content_block_insert: {
    deliverable: "content_block_insert",
    platform: "wordpress_self",
    variant: "yoast",
    title: "Insert a new content block",
    estimatedMinutes: 6,
    steps: [
      { text: "Open the page in the WordPress block editor.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Click the '+' button at the location in the editor where the new block should appear. Add a 'Paragraph' block (or 'Heading' if the content starts with a heading)." },
      { text: "Paste the new content into the block:", copyable: { label: "New content", valueKey: "proposed_value" }, warning: "Paste as plain text first (Ctrl+Shift+V) to avoid importing unwanted formatting, then apply bold/italic manually if needed." },
      { text: "Click 'Update'." },
    ],
  },

  full_article_publish: {
    deliverable: "full_article_publish",
    platform: "wordpress_self",
    variant: "yoast",
    title: "Publish the new article",
    estimatedMinutes: 12,
    prerequisites: ["A featured image ready in your media library", "Yoast SEO plugin installed and active"],
    steps: [
      { text: "Go to Posts > Add New in the WordPress admin." },
      { text: "Set the post title:", copyable: { label: "Post title", valueKey: "meta_title" } },
      { text: "Switch to the Code Editor view (Options menu > Code editor) and paste the article HTML body, then switch back to Visual Editor:", copyable: { label: "Article HTML", valueKey: "html_body" } },
      { text: "In the right panel under 'Post', set the URL slug:", copyable: { label: "Slug", valueKey: "slug" } },
      { text: "Scroll to the Yoast SEO box. Click 'Edit snippet' and set the meta description:", copyable: { label: "Meta description", valueKey: "meta_description" } },
      { text: "Set a featured image in the right panel (Post > Featured image)." },
      { text: "Assign the appropriate Category and any relevant Tags." },
      { text: "Click 'Publish'. Confirm the post is live at the slug URL." },
    ],
  },

  schema_org: {
    deliverable: "schema_org",
    platform: "wordpress_self",
    variant: "yoast",
    title: "Add custom structured data (JSON-LD)",
    estimatedMinutes: 8,
    prerequisites: ["Yoast SEO plugin installed and active"],
    steps: [
      { text: "Open the page in the WordPress block editor.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Click the '+' button to add a new block. Search for 'Custom HTML' and select it." },
      { text: "Paste the full JSON-LD script into the Custom HTML block:", copyable: { label: "JSON-LD", valueKey: "proposed_value" } },
      { text: "Place this block at the bottom of the page content so it doesn't disrupt the reading flow." },
      { text: "Click 'Update'." },
      { text: "Validate at https://search.google.com/test/rich-results by pasting the page URL. Confirm no errors appear.", warning: "Yoast generates its own schema for the page type. This custom block adds additional schema on top. The two can coexist as long as both are valid." },
    ],
  },

  faq_schema: {
    deliverable: "faq_schema",
    platform: "wordpress_self",
    variant: "yoast",
    title: "Add FAQ schema with a visible FAQ section",
    estimatedMinutes: 10,
    prerequisites: ["Yoast SEO plugin installed and active"],
    steps: [
      { text: "Open the page in the WordPress block editor.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Add the visible FAQ questions and answers to the page body. Use a 'Yoast FAQ' block (search for it in the block inserter) or plain Heading + Paragraph blocks. The visible text must match the questions and answers in the schema." },
      { text: "Add a 'Custom HTML' block below the FAQ section. Paste the JSON-LD:", copyable: { label: "FAQ JSON-LD", valueKey: "proposed_value" }, warning: "FAQ schema is only valid if the questions and answers are also visible on the page. Google will reject schema where the content is hidden or does not match." },
      { text: "Click 'Update'." },
      { text: "Validate at https://search.google.com/test/rich-results and confirm the FAQ rich result type is detected." },
    ],
  },

  location_signals: {
    deliverable: "location_signals",
    platform: "wordpress_self",
    variant: "yoast",
    title: "Add local business structured data",
    estimatedMinutes: 8,
    prerequisites: ["Yoast SEO plugin installed and active"],
    steps: [
      { text: "Open the page in the WordPress block editor (usually the homepage or a location page).", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Add a 'Custom HTML' block at the bottom of the page content." },
      { text: "Paste the LocalBusiness JSON-LD:", copyable: { label: "LocalBusiness JSON-LD", valueKey: "proposed_value" } },
      { text: "Verify the address, phone, and hours inside the JSON-LD match your Google Business Profile exactly." },
      { text: "Click 'Update', then validate at https://search.google.com/test/rich-results.", warning: "If you have Yoast Local SEO (premium add-on), use its dedicated Local SEO settings panel instead to avoid duplicate LocalBusiness schema." },
    ],
  },

  redirect: {
    deliverable: "redirect",
    platform: "wordpress_self",
    variant: "yoast",
    title: "Set up a 301 redirect",
    estimatedMinutes: 5,
    steps: [
      { text: "In the WordPress admin left menu, go to SEO > Redirects (Yoast Premium) or, if you are on the free plan, go to Tools > Redirection Plugin.", warning: "The Redirects menu requires Yoast Premium. If you do not have it, install the free 'Redirection' plugin by John Godley instead, then find it under Tools > Redirection." },
      { text: "Click 'Add new redirect' (Yoast) or 'Add new' (Redirection plugin)." },
      { text: "In the 'From URL' or 'Source URL' field, enter the old path (no domain needed, just the path):", copyable: { label: "From path", valueKey: "current_value" } },
      { text: "In the 'To URL' or 'Target URL' field, enter the destination:", copyable: { label: "To URL", valueKey: "proposed_value" } },
      { text: "Confirm the redirect type is 301 (Moved Permanently). Save." },
      { text: "Test in an incognito window: visiting the source path should land on the destination URL." },
    ],
  },

  canonical: {
    deliverable: "canonical",
    platform: "wordpress_self",
    variant: "yoast",
    title: "Set the canonical URL with Yoast SEO",
    estimatedMinutes: 4,
    prerequisites: ["Yoast SEO plugin installed and active"],
    steps: [
      { text: "Open the page or post in the WordPress editor.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Scroll to the Yoast SEO box. Click the 'Advanced' tab (the third tab in the Yoast panel, next to 'SEO' and 'Readability')." },
      { text: "Find the 'Canonical URL' field. Paste the canonical URL:", copyable: { label: "Canonical URL", valueKey: "proposed_value" } },
      { text: "Click 'Update'." },
      { text: "View-source the page and search for 'canonical' to confirm the <link rel=\"canonical\"> tag has the correct value." },
    ],
  },

  alt_text: {
    deliverable: "alt_text",
    platform: "wordpress_self",
    variant: "yoast",
    title: "Add alt text to an image",
    estimatedMinutes: 3,
    steps: [
      { text: "Go to Media > Library in the WordPress admin." },
      { text: "Find the image used on this page:", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Click the image to open its details panel. Update the 'Alt Text' field with:", copyable: { label: "Alt text", valueKey: "proposed_value" } },
      { text: "Click 'Save'." },
      { text: "Alternatively, if the image is a block in the page editor, click the image block and update 'Alt text' in the right-side panel under 'Image settings'.", warning: "Alt text set directly on the block only applies to that instance. Updating it in Media Library applies it everywhere the same image is used." },
    ],
  },

  robots_txt: {
    deliverable: "robots_txt",
    platform: "wordpress_self",
    variant: "yoast",
    title: "Update robots.txt via Yoast SEO",
    estimatedMinutes: 5,
    prerequisites: ["Yoast SEO plugin installed and active", "WordPress installed in the root directory (not a subdirectory)"],
    steps: [
      { text: "In the WordPress admin, go to SEO > Tools > File Editor." },
      { text: "You will see the current robots.txt content in a text area. Replace it with the new content:", copyable: { label: "robots.txt content", valueKey: "proposed_value" } },
      { text: "Click 'Save changes to robots.txt'.", warning: "Yoast only manages a virtual robots.txt (via WordPress's built-in filter) if no physical robots.txt file exists at the root. If a physical file exists on the server, Yoast cannot edit it here. In that case, update the file via FTP or your host's file manager." },
      { text: "Visit yourdomain.com/robots.txt in an incognito window to confirm the new content is live." },
    ],
  },

  sitemap_xml: {
    deliverable: "sitemap_xml",
    platform: "wordpress_self",
    variant: "yoast",
    title: "Verify and submit the XML sitemap",
    estimatedMinutes: 5,
    prerequisites: ["Yoast SEO plugin installed and active"],
    steps: [
      { text: "In the WordPress admin, go to SEO > General > Features. Confirm 'XML sitemaps' is toggled on." },
      { text: "Click the question mark icon next to 'XML sitemaps' and then 'See the XML sitemap' to open it. Your sitemap URL is typically yourdomain.com/sitemap_index.xml." },
      { text: "Go to https://search.google.com/search-console and select your property." },
      { text: "Under Indexing > Sitemaps, paste your sitemap URL and click 'Submit'.", warning: "If the sitemap was already submitted previously, you do not need to resubmit unless the URL changed. GSC will auto-re-crawl it." },
      { text: "Optionally, under SEO > Search Appearance > Content Types, confirm the page types you want in the sitemap have 'Show in sitemap' enabled." },
    ],
  },

  indexation_submit: {
    deliverable: "indexation_submit",
    platform: "wordpress_self",
    variant: "yoast",
    title: "Request indexation in Google Search Console",
    estimatedMinutes: 3,
    steps: [
      { text: "Go to https://search.google.com/search-console and select your property." },
      { text: "Paste the URL into the search bar at the top (URL Inspection tool):", copyable: { label: "URL to submit", valueKey: "page_url" } },
      { text: "Click 'Test Live URL' and wait for it to finish. Confirm there are no crawl or rendering errors." },
      { text: "Click 'Request Indexing'.", warning: "Google rate-limits this to roughly 10 requests per day per property. Prioritize the most important pages first." },
    ],
  },
};
