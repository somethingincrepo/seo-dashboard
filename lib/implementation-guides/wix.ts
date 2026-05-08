import type { CmsGuideTable } from "./types";

export const WIX_GUIDES: CmsGuideTable = {
  title_tag: {
    deliverable: "title_tag",
    platform: "wix",
    title: "Update the title tag in Wix",
    estimatedMinutes: 3,
    steps: [
      { text: "Log in to Wix and open your site editor." },
      { text: "In the left panel, click 'Menus & Pages' (or 'Pages' icon). Hover over the page and click the three dots > 'SEO Basics'.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Alternatively, go to Marketing & SEO > SEO Tools > Edit page SEO, then select the page from the list." },
      { text: "Under 'Title Tag', clear the current value and paste the new title:", copyable: { label: "New title tag", valueKey: "proposed_value" } },
      { text: "Click 'Save'. Wix saves and publishes this change immediately when you click 'Publish' in the editor toolbar." },
      { text: "View-source the live page and confirm the <title> tag reflects the new value." },
    ],
  },

  meta_description: {
    deliverable: "meta_description",
    platform: "wix",
    title: "Update the meta description in Wix",
    estimatedMinutes: 3,
    steps: [
      { text: "Go to Marketing & SEO > SEO Tools > Edit page SEO and select the page.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Find 'Meta Tag Description'. Clear and paste:", copyable: { label: "New meta description", valueKey: "proposed_value" } },
      { text: "Click 'Save', then publish the site." },
    ],
  },

  h1: {
    deliverable: "h1",
    platform: "wix",
    title: "Update the H1 heading in Wix",
    estimatedMinutes: 5,
    steps: [
      { text: "Open the page in the Wix Editor.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Click on the main heading text element. In the text toolbar at the top, confirm the text style is set to 'Heading 1' (shown in the style dropdown)." },
      { text: "Double-click to enter edit mode. Select all heading text and replace it:", copyable: { label: "New H1", valueKey: "proposed_value" } },
      { text: "Click outside the element to deselect." },
      { text: "Click 'Publish' in the top right.", warning: "Wix renders the text tag (H1, H2, etc.) based on the 'Text Theme' or 'Heading' style applied in the editor. If the heading element is styled as 'Heading 2', change it to 'Heading 1' in the text settings panel." },
    ],
  },

  internal_link_insertion: {
    deliverable: "internal_link_insertion",
    platform: "wix",
    title: "Add an internal link in Wix",
    estimatedMinutes: 5,
    steps: [
      { text: "Open the source page in the Wix Editor.", copyable: { label: "Source page", valueKey: "page_url" } },
      { text: "Click the text element containing the source paragraph:", copyable: { label: "Source paragraph", valueKey: "source_paragraph_text" } },
      { text: "Double-click to enter edit mode. Highlight the anchor text:", copyable: { label: "Anchor text", valueKey: "anchor_text" } },
      { text: "Click the link icon in the text toolbar. Select 'Web Address' and paste the destination URL:", copyable: { label: "Link target", valueKey: "target_url" } },
      { text: "Click 'Done'. Then click 'Publish'." },
    ],
  },

  content_rewrite: {
    deliverable: "content_rewrite",
    platform: "wix",
    title: "Apply the content rewrite in Wix",
    estimatedMinutes: 10,
    steps: [
      { text: "Open the page in the Wix Editor.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Click the text element containing:", copyable: { label: "Find this text", valueKey: "current_value" } },
      { text: "Double-click to edit. Select and replace the text with:", copyable: { label: "Replace with", valueKey: "proposed_value" } },
      { text: "Click 'Publish'." },
    ],
  },

  content_block_insert: {
    deliverable: "content_block_insert",
    platform: "wix",
    title: "Insert a new content block in Wix",
    estimatedMinutes: 6,
    steps: [
      { text: "Open the page in the Wix Editor.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Click the '+' Add Elements button on the left side. Under 'Text', drag a Paragraph or Heading element to the correct position on the canvas." },
      { text: "Double-click the new element and paste the content:", copyable: { label: "New content", valueKey: "proposed_value" } },
      { text: "Adjust the position and styling to match surrounding content." },
      { text: "Click 'Publish'." },
    ],
  },

  full_article_publish: {
    deliverable: "full_article_publish",
    platform: "wix",
    title: "Publish the new blog post in Wix",
    estimatedMinutes: 12,
    steps: [
      { text: "In the Wix dashboard (not the Editor), go to Blog > Posts > 'Create New Post'." },
      { text: "Set the post title:", copyable: { label: "Post title", valueKey: "meta_title" } },
      { text: "Click the post body area. For plain text: paste directly. For HTML content: click the '+' to add a custom HTML block and paste the article HTML there:", copyable: { label: "Article HTML", valueKey: "html_body" } },
      { text: "In the right panel, go to 'SEO' tab. Set the meta title and description:", copyable: { label: "Meta description", valueKey: "meta_description" } },
      { text: "Set the URL slug in the SEO tab:", copyable: { label: "Slug", valueKey: "slug" } },
      { text: "Add a Cover Image (featured image) via the right panel." },
      { text: "Set the Category and Tags." },
      { text: "Click 'Publish' to make the post live." },
    ],
  },

  schema_org: {
    deliverable: "schema_org",
    platform: "wix",
    title: "Add structured data (JSON-LD) in Wix",
    estimatedMinutes: 8,
    steps: [
      { text: "Go to Settings > Advanced Settings > Custom Code (in the Wix dashboard, not the editor).", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Click '+ Add Custom Code'." },
      { text: "Paste the JSON-LD script tag:", copyable: { label: "JSON-LD", valueKey: "proposed_value" } },
      { text: "Under 'Add Code to Pages', select 'Choose specific pages' and select the target page." },
      { text: "Set 'Place Code in' to 'Head'. Click 'Apply'." },
      { text: "Publish the site." },
      { text: "Validate at https://search.google.com/test/rich-results." },
    ],
  },

  faq_schema: {
    deliverable: "faq_schema",
    platform: "wix",
    title: "Add FAQ schema and visible FAQ section in Wix",
    estimatedMinutes: 12,
    steps: [
      { text: "Open the page in the Wix Editor.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Add the visible FAQ content to the page. Use the Wix Accordion app (available in the Editor via the '+' Add Elements panel > Apps) or add Heading + Text block pairs for each question and answer." },
      { text: "Go to Settings > Advanced Settings > Custom Code. Add a new code snippet with the FAQ JSON-LD:", copyable: { label: "FAQ JSON-LD", valueKey: "proposed_value" }, warning: "FAQ schema is only valid if the questions and answers appear visibly on the page. Do not add schema without the corresponding visible content." },
      { text: "Target the specific page, place in Head. Apply and publish." },
      { text: "Validate at https://search.google.com/test/rich-results." },
    ],
  },

  location_signals: {
    deliverable: "location_signals",
    platform: "wix",
    title: "Add local business structured data in Wix",
    estimatedMinutes: 8,
    steps: [
      { text: "Go to Settings > Advanced Settings > Custom Code in the Wix dashboard." },
      { text: "Click '+ Add Custom Code'." },
      { text: "Paste the LocalBusiness JSON-LD:", copyable: { label: "LocalBusiness JSON-LD", valueKey: "proposed_value" } },
      { text: "Target 'All Pages' or just the homepage. Place in Head. Click 'Apply'." },
      { text: "Verify the address, phone, and hours match your Google Business Profile." },
      { text: "Publish. Validate at https://search.google.com/test/rich-results." },
    ],
  },

  redirect: {
    deliverable: "redirect",
    platform: "wix",
    title: "Set up a 301 redirect in Wix",
    estimatedMinutes: 5,
    steps: [
      { text: "In the Wix dashboard, go to Marketing & SEO > SEO Tools > Redirects." },
      { text: "Click '+ New Redirect'." },
      { text: "In the 'Old URL' field, enter the old path:", copyable: { label: "From path", valueKey: "current_value" } },
      { text: "In the 'New URL' field, enter the destination:", copyable: { label: "To URL", valueKey: "proposed_value" } },
      { text: "Wix redirects default to 301. Click 'Save'." },
      { text: "Test in an incognito window." },
    ],
  },

  canonical: {
    deliverable: "canonical",
    platform: "wix",
    title: "Set the canonical URL in Wix",
    estimatedMinutes: 4,
    steps: [
      { text: "Go to Marketing & SEO > SEO Tools > Edit page SEO and select the page.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Scroll to 'Additional Tags' or 'Advanced SEO'. Click 'Add New Tag'." },
      { text: "Set the tag type to 'link' and enter rel=\"canonical\" and href with the canonical URL:", copyable: { label: "Canonical URL", valueKey: "proposed_value" } },
      { text: "Alternatively, if a dedicated Canonical URL field is shown in the Advanced SEO section, paste the URL there directly." },
      { text: "Click 'Save', then publish." },
      { text: "View-source the page and search for 'canonical' to confirm." },
    ],
  },

  alt_text: {
    deliverable: "alt_text",
    platform: "wix",
    title: "Add alt text to an image in Wix",
    estimatedMinutes: 3,
    steps: [
      { text: "Open the page in the Wix Editor.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Click the image to select it. In the blue toolbar that appears above the image, click 'Settings' (gear icon)." },
      { text: "Find the 'Alt Text' field. Paste the new alt text:", copyable: { label: "Alt text", valueKey: "proposed_value" } },
      { text: "Click outside to confirm. Click 'Publish'.", warning: "Wix Media Manager also has an alt text field per image. Updating it there changes the default alt text for that image across the site, but in-editor overrides take precedence." },
    ],
  },

  robots_txt: {
    deliverable: "robots_txt",
    platform: "wix",
    title: "Update robots.txt in Wix",
    estimatedMinutes: 5,
    steps: [
      { text: "In the Wix dashboard, go to Marketing & SEO > SEO Tools > Robots.txt." },
      { text: "The current robots.txt content is shown in an editor. Update it with the new content:", copyable: { label: "robots.txt content", valueKey: "proposed_value" } },
      { text: "Click 'Save'." },
      { text: "Visit yourdomain.com/robots.txt in an incognito window to confirm the new content.", warning: "Wix auto-generates some default rules (e.g., for dynamic pages). Be careful not to remove rules you did not intend to change." },
    ],
  },

  sitemap_xml: {
    deliverable: "sitemap_xml",
    platform: "wix",
    title: "Submit the Wix sitemap to Google Search Console",
    estimatedMinutes: 4,
    steps: [
      { text: "Wix automatically generates a sitemap. In the Wix dashboard, go to Marketing & SEO > SEO Tools > Sitemap to view the sitemap URL." },
      { text: "Your sitemap is typically at yourdomain.com/sitemap.xml." },
      { text: "Go to https://search.google.com/search-console > Indexing > Sitemaps." },
      { text: "Enter the sitemap URL and click 'Submit'." },
    ],
  },

  indexation_submit: {
    deliverable: "indexation_submit",
    platform: "wix",
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
