import type { CmsGuideTable } from "./types";

export const WORDPRESS_RANKMATH_GUIDES: CmsGuideTable = {
  title_tag: {
    deliverable: "title_tag",
    platform: "wordpress_self",
    variant: "rankmath",
    title: "Update the title tag with Rank Math",
    estimatedMinutes: 3,
    prerequisites: ["Rank Math SEO plugin installed and active"],
    steps: [
      { text: "Log in to WordPress and open the page or post in the editor.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "In the right-side panel, click the Rank Math icon (the R shield icon) to open the Rank Math sidebar. If you do not see it, click 'Rank Math' in the top toolbar." },
      { text: "Click 'Edit Snippet'. In the 'Title' field, clear the existing value and paste the new title:", copyable: { label: "New title tag", valueKey: "proposed_value" } },
      { text: "The character counter should show green. Click outside the snippet editor to close it." },
      { text: "Click 'Update' or 'Publish'." },
      { text: "View-source the page (Ctrl+U) and search for '<title>' to confirm the change is live." },
    ],
  },

  meta_description: {
    deliverable: "meta_description",
    platform: "wordpress_self",
    variant: "rankmath",
    title: "Update the meta description with Rank Math",
    estimatedMinutes: 3,
    prerequisites: ["Rank Math SEO plugin installed and active"],
    steps: [
      { text: "Open the page or post in the WordPress editor.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Click the Rank Math icon in the right panel to open the sidebar, then click 'Edit Snippet'." },
      { text: "Clear the 'Description' field and paste the new meta description:", copyable: { label: "New meta description", valueKey: "proposed_value" } },
      { text: "Click 'Update' or 'Publish'.", warning: "If the old description still appears in Google after a few days, this is a caching issue on Google's side and will self-correct. Clear any WordPress caching plugin cache as a precaution." },
    ],
  },

  h1: {
    deliverable: "h1",
    platform: "wordpress_self",
    variant: "rankmath",
    title: "Update the H1 heading",
    estimatedMinutes: 4,
    steps: [
      { text: "Open the page or post in the WordPress block editor.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "The page title field at the very top of the editor (labeled 'Add title') renders as the H1 on most themes. Update it:", copyable: { label: "New H1", valueKey: "proposed_value" } },
      { text: "If a Heading block is used for the H1 instead (less common), click that block and confirm the 'H1' level is selected in the block toolbar before editing the text." },
      { text: "Click 'Update'." },
      { text: "Right-click the live page > Inspect > Elements and search for '<h1' to confirm only one H1 exists.", warning: "Some page builders may override the title rendering. If the H1 on the live page does not change, check the builder's heading settings." },
    ],
  },

  internal_link_insertion: {
    deliverable: "internal_link_insertion",
    platform: "wordpress_self",
    variant: "rankmath",
    title: "Add an internal link",
    estimatedMinutes: 5,
    steps: [
      { text: "Open the source page in the WordPress block editor.", copyable: { label: "Source page", valueKey: "page_url" } },
      { text: "Find the paragraph block containing this text:", copyable: { label: "Source paragraph", valueKey: "source_paragraph_text" } },
      { text: "Click the paragraph to select it. Highlight the anchor text:", copyable: { label: "Anchor text", valueKey: "anchor_text" } },
      { text: "Press Ctrl+K (or Cmd+K on Mac) to open the link dialog. Paste the link destination:", copyable: { label: "Link target", valueKey: "target_url" } },
      { text: "Press Enter to apply. Click 'Update'." },
    ],
  },

  content_rewrite: {
    deliverable: "content_rewrite",
    platform: "wordpress_self",
    variant: "rankmath",
    title: "Apply the content rewrite",
    estimatedMinutes: 10,
    steps: [
      { text: "Open the page in the WordPress block editor.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Find the block containing this existing text:", copyable: { label: "Find this text", valueKey: "current_value" } },
      { text: "Select all text in the block and replace it with:", copyable: { label: "Replace with", valueKey: "proposed_value" } },
      { text: "Confirm formatting is consistent with surrounding content." },
      { text: "Click 'Update'." },
    ],
  },

  content_block_insert: {
    deliverable: "content_block_insert",
    platform: "wordpress_self",
    variant: "rankmath",
    title: "Insert a new content block",
    estimatedMinutes: 6,
    steps: [
      { text: "Open the page in the WordPress block editor.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Click the '+' icon at the position where the new content should appear. Add a Paragraph block (or Heading block if the content begins with a heading)." },
      { text: "Paste the new content:", copyable: { label: "New content", valueKey: "proposed_value" }, warning: "Use Ctrl+Shift+V (or Cmd+Shift+V on Mac) to paste as plain text and avoid importing external styling." },
      { text: "Click 'Update'." },
    ],
  },

  full_article_publish: {
    deliverable: "full_article_publish",
    platform: "wordpress_self",
    variant: "rankmath",
    title: "Publish the new article",
    estimatedMinutes: 12,
    prerequisites: ["A featured image ready in your media library", "Rank Math SEO plugin installed and active"],
    steps: [
      { text: "Go to Posts > Add New in the WordPress admin." },
      { text: "Set the post title:", copyable: { label: "Post title", valueKey: "meta_title" } },
      { text: "Switch to Code Editor (Options > Code editor), paste the article HTML, then switch back to Visual Editor:", copyable: { label: "Article HTML", valueKey: "html_body" } },
      { text: "In the right panel, set the URL slug under 'Permalink':", copyable: { label: "Slug", valueKey: "slug" } },
      { text: "Open the Rank Math sidebar (R icon). Click 'Edit Snippet' and set the meta description:", copyable: { label: "Meta description", valueKey: "meta_description" } },
      { text: "Set a featured image in the right panel." },
      { text: "Assign the appropriate Category and Tags." },
      { text: "Click 'Publish'." },
    ],
  },

  schema_org: {
    deliverable: "schema_org",
    platform: "wordpress_self",
    variant: "rankmath",
    title: "Add custom structured data with Rank Math",
    estimatedMinutes: 8,
    prerequisites: ["Rank Math SEO plugin installed and active"],
    steps: [
      { text: "Open the page in the WordPress block editor.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Open the Rank Math sidebar. Click 'Schema' (the third tab in the sidebar)." },
      { text: "Click 'Schema Generator' or 'Add Schema'. Select 'Custom Schema' from the schema type list." },
      { text: "In the custom schema editor, paste the JSON-LD object (without the outer <script> tag -- Rank Math wraps it automatically):", copyable: { label: "JSON-LD", valueKey: "proposed_value" } },
      { text: "If Rank Math's schema builder does not accept raw JSON, fall back to adding a Custom HTML block in the editor and paste the full <script type=\"application/ld+json\"> tag there instead." },
      { text: "Click 'Update'." },
      { text: "Validate at https://search.google.com/test/rich-results." },
    ],
  },

  faq_schema: {
    deliverable: "faq_schema",
    platform: "wordpress_self",
    variant: "rankmath",
    title: "Add FAQ schema with Rank Math",
    estimatedMinutes: 10,
    prerequisites: ["Rank Math SEO plugin installed and active"],
    steps: [
      { text: "Open the page in the WordPress block editor.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Add the visible FAQ questions and answers to the page body using Paragraph or Heading blocks. The content must be visible on the page -- Google requires this." },
      { text: "Open the Rank Math sidebar > Schema tab > Schema Generator. Select 'FAQ Page' from the schema type list." },
      { text: "Fill in each question and answer in the Rank Math FAQ schema builder to match the visible content, OR use a Custom HTML block with the full JSON-LD:", copyable: { label: "FAQ JSON-LD", valueKey: "proposed_value" }, warning: "Use one method only. Do not add both a Rank Math FAQ schema and a Custom HTML script tag for the same content -- duplicate schema can cause validation errors." },
      { text: "Click 'Update', then validate at https://search.google.com/test/rich-results." },
    ],
  },

  location_signals: {
    deliverable: "location_signals",
    platform: "wordpress_self",
    variant: "rankmath",
    title: "Add local business structured data with Rank Math",
    estimatedMinutes: 8,
    prerequisites: ["Rank Math SEO plugin installed and active"],
    steps: [
      { text: "Open the page in the WordPress block editor (typically the homepage or a location/contact page).", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Open the Rank Math sidebar > Schema tab > Schema Generator. Select 'Local Business'." },
      { text: "Fill in the name, address, phone, hours, and URL fields to match your Google Business Profile exactly." },
      { text: "Alternatively, add a Custom HTML block with the full JSON-LD provided below:", copyable: { label: "LocalBusiness JSON-LD", valueKey: "proposed_value" } },
      { text: "Click 'Update', then validate at https://search.google.com/test/rich-results.", warning: "Check Rank Math > Titles & Meta > Local SEO to ensure it is not generating a conflicting LocalBusiness schema globally. If it is, disable the global one and use this page-level schema only." },
    ],
  },

  redirect: {
    deliverable: "redirect",
    platform: "wordpress_self",
    variant: "rankmath",
    title: "Set up a 301 redirect with Rank Math",
    estimatedMinutes: 5,
    prerequisites: ["Rank Math SEO plugin installed and active"],
    steps: [
      { text: "In the WordPress admin, go to Rank Math > Redirections in the left menu." },
      { text: "Click 'Add Redirect'." },
      { text: "In the 'Source URLs' field, enter the old path:", copyable: { label: "From path", valueKey: "current_value" } },
      { text: "In the 'Destination URL' field, enter the destination:", copyable: { label: "To URL", valueKey: "proposed_value" } },
      { text: "Set 'Redirect Type' to '301 Permanent Move'. Click 'Save'." },
      { text: "Test in an incognito window: visiting the source path should land on the destination with a 301 status code." },
    ],
  },

  canonical: {
    deliverable: "canonical",
    platform: "wordpress_self",
    variant: "rankmath",
    title: "Set the canonical URL with Rank Math",
    estimatedMinutes: 4,
    prerequisites: ["Rank Math SEO plugin installed and active"],
    steps: [
      { text: "Open the page or post in the WordPress editor.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Open the Rank Math sidebar. Click the 'Advanced' tab (the last tab, with a gear icon)." },
      { text: "Find the 'Canonical URL' field. Paste the canonical URL:", copyable: { label: "Canonical URL", valueKey: "proposed_value" } },
      { text: "Click 'Update'." },
      { text: "View-source the live page and search for 'canonical' to confirm the <link rel=\"canonical\"> tag is correct." },
    ],
  },

  alt_text: {
    deliverable: "alt_text",
    platform: "wordpress_self",
    variant: "rankmath",
    title: "Add alt text to an image",
    estimatedMinutes: 3,
    steps: [
      { text: "Go to Media > Library in the WordPress admin." },
      { text: "Find the image on this page:", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Click the image to open the attachment details. Update the 'Alt Text' field:", copyable: { label: "Alt text", valueKey: "proposed_value" } },
      { text: "Click 'Save'. Changes apply everywhere the image is used." },
      { text: "If the image is an embedded block on the page, you can also click the image block in the editor and update 'Alt text' in the right-side 'Image settings' panel." },
    ],
  },

  robots_txt: {
    deliverable: "robots_txt",
    platform: "wordpress_self",
    variant: "rankmath",
    title: "Update robots.txt via Rank Math",
    estimatedMinutes: 5,
    prerequisites: ["Rank Math SEO plugin installed and active"],
    steps: [
      { text: "In the WordPress admin, go to Rank Math > General Settings." },
      { text: "Click the 'Edit robots.txt' link in the Tools section (or navigate to Rank Math > Status and Tools > Edit robots.txt)." },
      { text: "Replace the content of the robots.txt editor with:", copyable: { label: "robots.txt content", valueKey: "proposed_value" } },
      { text: "Click 'Save Changes'.", warning: "Rank Math edits the virtual robots.txt filtered by WordPress. If a physical robots.txt file exists at the site root (check via FTP), that file takes precedence and must be edited directly." },
      { text: "Visit yourdomain.com/robots.txt in an incognito window to confirm the updated content." },
    ],
  },

  sitemap_xml: {
    deliverable: "sitemap_xml",
    platform: "wordpress_self",
    variant: "rankmath",
    title: "Verify and submit the XML sitemap",
    estimatedMinutes: 5,
    prerequisites: ["Rank Math SEO plugin installed and active"],
    steps: [
      { text: "Go to Rank Math > Sitemap Settings in the WordPress admin. Confirm 'Sitemap' is turned on and the desired content types are included." },
      { text: "Your sitemap URL is yourdomain.com/sitemap_index.xml. Open it to verify it lists the correct pages." },
      { text: "Go to https://search.google.com/search-console > Indexing > Sitemaps." },
      { text: "Paste your sitemap URL and click 'Submit'.", warning: "If the sitemap was already submitted, Google re-crawls it automatically. Resubmit only if the sitemap URL changed or you want to force a re-crawl." },
    ],
  },

  indexation_submit: {
    deliverable: "indexation_submit",
    platform: "wordpress_self",
    variant: "rankmath",
    title: "Request indexation in Google Search Console",
    estimatedMinutes: 3,
    steps: [
      { text: "Go to https://search.google.com/search-console and select your property." },
      { text: "Paste the URL into the inspection bar at the top:", copyable: { label: "URL to submit", valueKey: "page_url" } },
      { text: "Click 'Test Live URL' and wait for confirmation there are no crawl errors." },
      { text: "Click 'Request Indexing'.", warning: "Google limits this to roughly 10 URL requests per day per property." },
    ],
  },
};
