import type { CmsGuideTable } from "./types";

export const HUBSPOT_GUIDES: CmsGuideTable = {
  title_tag: {
    deliverable: "title_tag",
    platform: "hubspot",
    title: "Update the title tag in HubSpot",
    estimatedMinutes: 3,
    steps: [
      { text: "Log in to HubSpot and go to Marketing > Website > Website Pages (or Landing Pages for landing pages)." },
      { text: "Find the page and click 'Edit'.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "In the page editor, click the 'Settings' tab at the top (next to 'Content')." },
      { text: "Find the 'Page title' field. Clear it and paste the new title:", copyable: { label: "New title tag", valueKey: "proposed_value" } },
      { text: "Click 'Update' or 'Publish changes' in the top right." },
      { text: "View-source the live page and confirm the <title> tag is updated." },
    ],
  },

  meta_description: {
    deliverable: "meta_description",
    platform: "hubspot",
    title: "Update the meta description in HubSpot",
    estimatedMinutes: 3,
    steps: [
      { text: "Open the page in HubSpot editor > Settings tab.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Find 'Meta description'. Clear and paste:", copyable: { label: "New meta description", valueKey: "proposed_value" } },
      { text: "Click 'Update' or 'Publish changes'.", warning: "HubSpot may show a character count warning if the description is longer than 160 characters. This is advisory -- the value will still be published as entered." },
    ],
  },

  h1: {
    deliverable: "h1",
    platform: "hubspot",
    title: "Update the H1 heading in HubSpot",
    estimatedMinutes: 5,
    steps: [
      { text: "Open the page in the HubSpot editor.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Click on the 'Content' tab to see the page layout." },
      { text: "Find the main heading element near the top of the page. Click it to select it and enter editing mode." },
      { text: "In the text editor that appears, select all existing heading text and replace it:", copyable: { label: "New H1", valueKey: "proposed_value" } },
      { text: "Confirm the heading style is set to H1. In the HubSpot rich text toolbar, the heading level dropdown shows the tag (Heading 1, Heading 2, etc.)." },
      { text: "Click 'Publish changes'.", warning: "In drag-and-drop templates, the header module might use the page title field from the Settings tab as the H1, not an editable heading in the content area. Check both places." },
    ],
  },

  internal_link_insertion: {
    deliverable: "internal_link_insertion",
    platform: "hubspot",
    title: "Add an internal link in HubSpot",
    estimatedMinutes: 5,
    steps: [
      { text: "Open the source page in the HubSpot editor.", copyable: { label: "Source page", valueKey: "page_url" } },
      { text: "Click the Rich Text module containing the target paragraph." },
      { text: "Find the paragraph:", copyable: { label: "Source paragraph", valueKey: "source_paragraph_text" } },
      { text: "Highlight the anchor text:", copyable: { label: "Anchor text", valueKey: "anchor_text" } },
      { text: "Click the link icon (chain link) in the rich text toolbar. Paste the destination URL:", copyable: { label: "Link target", valueKey: "target_url" } },
      { text: "Click 'Insert'. Then click 'Publish changes'." },
    ],
  },

  content_rewrite: {
    deliverable: "content_rewrite",
    platform: "hubspot",
    title: "Apply the content rewrite in HubSpot",
    estimatedMinutes: 10,
    steps: [
      { text: "Open the page in the HubSpot editor.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Click the Rich Text module containing the content to replace." },
      { text: "Find the existing text:", copyable: { label: "Find this text", valueKey: "current_value" } },
      { text: "Select and delete that text. Paste the replacement:", copyable: { label: "Replace with", valueKey: "proposed_value" } },
      { text: "Click 'Publish changes'." },
    ],
  },

  content_block_insert: {
    deliverable: "content_block_insert",
    platform: "hubspot",
    title: "Insert a new content block in HubSpot",
    estimatedMinutes: 7,
    steps: [
      { text: "Open the page in the HubSpot editor.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "In the page layout, click the '+' button to add a new module at the desired position." },
      { text: "Select 'Rich Text' from the module list." },
      { text: "Click the new Rich Text module and paste the content:", copyable: { label: "New content", valueKey: "proposed_value" } },
      { text: "Click 'Publish changes'." },
    ],
  },

  full_article_publish: {
    deliverable: "full_article_publish",
    platform: "hubspot",
    title: "Publish the new blog post in HubSpot",
    estimatedMinutes: 12,
    steps: [
      { text: "In HubSpot, go to Marketing > Blog > 'Create post' (or 'Write a blog post')." },
      { text: "Set the post title:", copyable: { label: "Post title", valueKey: "meta_title" } },
      { text: "In the blog body editor, click the source code icon (</>) and paste the article HTML:", copyable: { label: "Article HTML", valueKey: "html_body" } },
      { text: "Click the source code icon again to return to the visual editor." },
      { text: "Click the 'Settings' tab. Set the URL slug:", copyable: { label: "Slug", valueKey: "slug" } },
      { text: "Set the meta description:", copyable: { label: "Meta description", valueKey: "meta_description" } },
      { text: "Set the Featured Image, Author, and Blog (if you have multiple blogs)." },
      { text: "Click 'Publish now' or schedule for the agreed date." },
    ],
  },

  schema_org: {
    deliverable: "schema_org",
    platform: "hubspot",
    title: "Add structured data (JSON-LD) in HubSpot",
    estimatedMinutes: 8,
    steps: [
      { text: "Open the page in the HubSpot editor > Settings tab.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Scroll down to 'Advanced Options' and expand it. Find 'Additional code snippets' or 'Head HTML'." },
      { text: "Paste the JSON-LD script tag in the Head HTML field:", copyable: { label: "JSON-LD", valueKey: "proposed_value" } },
      { text: "Click 'Publish changes'." },
      { text: "Validate at https://search.google.com/test/rich-results.", warning: "If 'Head HTML' is not available on the Settings tab, it may need to be enabled via your HubSpot subscription or by a developer editing the template in the Design Manager." },
    ],
  },

  faq_schema: {
    deliverable: "faq_schema",
    platform: "hubspot",
    title: "Add FAQ schema and visible FAQ section in HubSpot",
    estimatedMinutes: 12,
    steps: [
      { text: "Open the page in the HubSpot editor.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Add a Rich Text module with the visible FAQ questions and answers. The content must be readable on the page." },
      { text: "Open the Settings tab > Advanced Options > Head HTML. Paste the FAQ JSON-LD:", copyable: { label: "FAQ JSON-LD", valueKey: "proposed_value" }, warning: "FAQ schema requires the questions and answers to appear visibly on the page. Do not add the schema without the visible content." },
      { text: "Click 'Publish changes'." },
      { text: "Validate at https://search.google.com/test/rich-results." },
    ],
  },

  location_signals: {
    deliverable: "location_signals",
    platform: "hubspot",
    title: "Add local business structured data in HubSpot",
    estimatedMinutes: 8,
    steps: [
      { text: "Open the homepage or location page in the HubSpot editor > Settings tab.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Expand 'Advanced Options' > Head HTML. Paste the LocalBusiness JSON-LD:", copyable: { label: "LocalBusiness JSON-LD", valueKey: "proposed_value" } },
      { text: "Verify the address, phone, and hours match your Google Business Profile." },
      { text: "Click 'Publish changes'." },
      { text: "Validate at https://search.google.com/test/rich-results." },
    ],
  },

  redirect: {
    deliverable: "redirect",
    platform: "hubspot",
    title: "Set up a 301 redirect in HubSpot",
    estimatedMinutes: 5,
    steps: [
      { text: "In HubSpot, go to Domains & URLs in the main navigation (under Settings > Website > Domains & URLs, or via the search bar)." },
      { text: "Click 'URL Redirects' > 'Add URL redirect'." },
      { text: "In the 'Original URL' field, enter the old path or full URL:", copyable: { label: "From URL", valueKey: "current_value" } },
      { text: "In the 'Redirect to' field, enter the destination:", copyable: { label: "To URL", valueKey: "proposed_value" } },
      { text: "Set the redirect type to '301 Moved Permanently'. Click 'Save'." },
      { text: "Test in an incognito window." },
    ],
  },

  canonical: {
    deliverable: "canonical",
    platform: "hubspot",
    title: "Set the canonical URL in HubSpot",
    estimatedMinutes: 4,
    steps: [
      { text: "Open the page in the HubSpot editor > Settings tab.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Scroll to 'Advanced Options'. Find the 'Canonical URL' field." },
      { text: "Paste the canonical URL:", copyable: { label: "Canonical URL", valueKey: "proposed_value" } },
      { text: "Click 'Publish changes'." },
      { text: "View-source the page and search for 'canonical' to confirm the tag is set correctly." },
    ],
  },

  alt_text: {
    deliverable: "alt_text",
    platform: "hubspot",
    title: "Add alt text to an image in HubSpot",
    estimatedMinutes: 3,
    steps: [
      { text: "To update an image on a page: open the page in the editor, click the image module, and find the 'Alt text' field in the module settings panel on the left.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Update the alt text field:", copyable: { label: "Alt text", valueKey: "proposed_value" } },
      { text: "To update alt text in the Files library (applies where the image is reused): go to Marketing > Files and Templates > Files. Click the image > 'Edit'> update the Alt text." },
      { text: "Click 'Save' / 'Publish changes'." },
    ],
  },

  robots_txt: {
    deliverable: "robots_txt",
    platform: "hubspot",
    title: "Update robots.txt in HubSpot",
    estimatedMinutes: 5,
    steps: [
      { text: "In HubSpot, go to Settings (gear icon) > Website > Pages." },
      { text: "Scroll down to find the 'Robots.txt' section. Click 'Manage robots.txt'.", warning: "The robots.txt editor is typically only available on CMS Hub Professional and Enterprise plans. On lower tiers, HubSpot manages robots.txt automatically." },
      { text: "Update the content:", copyable: { label: "robots.txt content", valueKey: "proposed_value" } },
      { text: "Click 'Save'." },
      { text: "Visit yourdomain.com/robots.txt in an incognito window to confirm." },
    ],
  },

  sitemap_xml: {
    deliverable: "sitemap_xml",
    platform: "hubspot",
    title: "Submit the HubSpot sitemap to Google Search Console",
    estimatedMinutes: 4,
    steps: [
      { text: "HubSpot automatically generates and maintains a sitemap. Your sitemap URL is typically yourdomain.com/sitemap.xml." },
      { text: "Go to Settings > Website > Pages > scroll to 'Sitemap' to confirm the sitemap is enabled and the URL." },
      { text: "Go to https://search.google.com/search-console > Indexing > Sitemaps." },
      { text: "Enter the sitemap URL and click 'Submit'." },
    ],
  },

  indexation_submit: {
    deliverable: "indexation_submit",
    platform: "hubspot",
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
