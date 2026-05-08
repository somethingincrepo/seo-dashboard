import type { CmsGuideTable } from "./types";

export const SHOPIFY_GUIDES: CmsGuideTable = {
  title_tag: {
    deliverable: "title_tag",
    platform: "shopify",
    title: "Update the title tag in Shopify",
    estimatedMinutes: 3,
    steps: [
      { text: "Log in to your Shopify admin. Navigate to the page, product, or collection that needs updating.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "For a Page: go to Online Store > Pages > click the page title." },
      { text: "For a Product: go to Products > click the product name." },
      { text: "For a Collection: go to Products > Collections > click the collection." },
      { text: "Scroll to the bottom of the edit screen to the 'Search engine listing' section. Click 'Edit website SEO'." },
      { text: "Clear the 'Page title' field and paste the new title:", copyable: { label: "New title tag", valueKey: "proposed_value" } },
      { text: "Click 'Save'. The change goes live immediately -- no separate publish step needed." },
    ],
  },

  meta_description: {
    deliverable: "meta_description",
    platform: "shopify",
    title: "Update the meta description in Shopify",
    estimatedMinutes: 3,
    steps: [
      { text: "Navigate to the page, product, or collection in your Shopify admin.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Scroll to the bottom > 'Search engine listing' > 'Edit website SEO'." },
      { text: "Clear the 'Meta description' field and paste:", copyable: { label: "New meta description", valueKey: "proposed_value" } },
      { text: "Click 'Save'.", warning: "Shopify caches storefront pages. If the change doesn't appear in view-source immediately, wait up to 15 minutes or trigger a theme save to bust the cache." },
    ],
  },

  h1: {
    deliverable: "h1",
    platform: "shopify",
    title: "Update the H1 heading in Shopify",
    estimatedMinutes: 4,
    steps: [
      { text: "Open the relevant content in Shopify admin.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "For a Page or Blog Post: the 'Title' field at the top of the editor renders as the H1 in most Shopify themes. Update it:", copyable: { label: "New H1", valueKey: "proposed_value" } },
      { text: "For a Product: the 'Title' field on the product edit screen is rendered as H1 by most themes." },
      { text: "For a Collection: the 'Title' field on the collection edit screen is the H1." },
      { text: "Click 'Save'." },
      { text: "View the live page and right-click > Inspect to search for '<h1' and confirm the new text is present.", warning: "If your theme uses a custom section that overrides the H1, you may also need to edit that section in Online Store > Themes > Customize." },
    ],
  },

  internal_link_insertion: {
    deliverable: "internal_link_insertion",
    platform: "shopify",
    title: "Add an internal link in Shopify",
    estimatedMinutes: 5,
    steps: [
      { text: "Open the source page, product, or post in the Shopify admin editor.", copyable: { label: "Source page", valueKey: "page_url" } },
      { text: "In the rich text editor, find the paragraph containing this text:", copyable: { label: "Source paragraph", valueKey: "source_paragraph_text" } },
      { text: "Highlight the anchor text:", copyable: { label: "Anchor text", valueKey: "anchor_text" } },
      { text: "Click the link icon in the editor toolbar (looks like a chain link). Paste the destination URL:", copyable: { label: "Link target", valueKey: "target_url" } },
      { text: "Click 'Insert link'. Click 'Save'." },
    ],
  },

  content_rewrite: {
    deliverable: "content_rewrite",
    platform: "shopify",
    title: "Apply the content rewrite in Shopify",
    estimatedMinutes: 10,
    steps: [
      { text: "Open the page, product, or post in the Shopify admin editor.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Find the section to replace. The existing text reads:", copyable: { label: "Find this text", valueKey: "current_value" } },
      { text: "Select and delete that text, then paste the replacement:", copyable: { label: "Replace with", valueKey: "proposed_value" } },
      { text: "Click 'Save'." },
    ],
  },

  content_block_insert: {
    deliverable: "content_block_insert",
    platform: "shopify",
    title: "Insert a new content block in Shopify",
    estimatedMinutes: 6,
    steps: [
      { text: "Open the page, product, or post in the Shopify admin editor.", copyable: { label: "Page URL", valueKey: "page_url" } },
      { text: "Click at the position in the content where the new block should appear." },
      { text: "Paste the new content:", copyable: { label: "New content", valueKey: "proposed_value" }, warning: "Paste as plain text first to avoid importing unwanted HTML. Use the HTML editor (</> icon) if you need to paste raw HTML." },
      { text: "Click 'Save'." },
    ],
  },

  full_article_publish: {
    deliverable: "full_article_publish",
    platform: "shopify",
    title: "Publish the new blog post in Shopify",
    estimatedMinutes: 12,
    steps: [
      { text: "In the Shopify admin, go to Online Store > Blog Posts > 'Create blog post'." },
      { text: "Set the post title:", copyable: { label: "Post title", valueKey: "meta_title" } },
      { text: "Click the HTML source icon (</>) in the content editor and paste the article HTML:", copyable: { label: "Article HTML", valueKey: "html_body" } },
      { text: "Click the HTML icon again to return to the visual editor and check formatting." },
      { text: "In the right panel, expand 'Search engine listing' > 'Edit website SEO'." },
      { text: "Set the URL and handle (slug):", copyable: { label: "Slug", valueKey: "slug" } },
      { text: "Set the meta description:", copyable: { label: "Meta description", valueKey: "meta_description" } },
      { text: "Set a featured image, assign the correct blog (e.g. 'News' or your primary blog), and set the author." },
      { text: "Click 'Save'. In the right panel under 'Visibility', set to 'Visible' if not already set, then confirm the post is live." },
    ],
  },

  schema_org: {
    deliverable: "schema_org",
    platform: "shopify",
    title: "Add structured data (JSON-LD) to a Shopify page",
    estimatedMinutes: 10,
    prerequisites: ["Access to Online Store > Themes > Edit code"],
    steps: [
      { text: "In Shopify admin, go to Online Store > Themes > Actions > Edit code." },
      { text: "In the file tree, open the template for the page type. For a regular page: templates/page.liquid (or templates/page.json if the theme uses JSON templates). For a product: templates/product.liquid." },
      { text: "If the template is a JSON template (.json), you need to edit the corresponding section file referenced in it, then add a Liquid block or a custom section that outputs the JSON-LD.", warning: "In newer Shopify Online Store 2.0 themes, templates are JSON files. The recommended approach is to create a new custom section (sections/custom-schema.liquid) with a schema tag and include it." },
      { text: "For classic liquid templates, add this block just before the closing </article> or </div> of the main content area:", copyable: { label: "JSON-LD", valueKey: "proposed_value" } },
      { text: "To target only a specific page by handle, wrap it: {% if page.handle == 'your-page-handle' %} ... {% endif %}" },
      { text: "Click 'Save'. Validate at https://search.google.com/test/rich-results." },
    ],
  },

  faq_schema: {
    deliverable: "faq_schema",
    platform: "shopify",
    title: "Add FAQ schema to a Shopify page",
    estimatedMinutes: 12,
    prerequisites: ["Access to Online Store > Themes > Edit code"],
    steps: [
      { text: "Open the page in Shopify admin and add the visible FAQ questions and answers to the page body using the rich text editor. These must be visible to users." },
      { text: "Go to Online Store > Themes > Actions > Edit code." },
      { text: "Open the relevant template file (e.g. templates/page.liquid) and add the FAQ JSON-LD near the bottom of the template, wrapped in a page handle conditional if needed:", copyable: { label: "FAQ JSON-LD", valueKey: "proposed_value" } },
      { text: "Click 'Save'." },
      { text: "Validate at https://search.google.com/test/rich-results and confirm the FAQ rich result is detected.", warning: "FAQ schema is only valid when the questions and answers are visible on the page. Hidden or dynamically loaded content will be rejected by Google." },
    ],
  },

  location_signals: {
    deliverable: "location_signals",
    platform: "shopify",
    title: "Add local business structured data in Shopify",
    estimatedMinutes: 10,
    prerequisites: ["Access to Online Store > Themes > Edit code"],
    steps: [
      { text: "Go to Online Store > Themes > Actions > Edit code." },
      { text: "Open layout/theme.liquid." },
      { text: "Find the closing </head> tag. Paste the LocalBusiness JSON-LD just before it:", copyable: { label: "LocalBusiness JSON-LD", valueKey: "proposed_value" } },
      { text: "Click 'Save'." },
      { text: "Verify the address and hours match your Google Business Profile.", warning: "Placing this in theme.liquid makes it appear on every page. If you only want it on the homepage, wrap it: {% if request.page_type == 'index' %} ... {% endif %}" },
      { text: "Validate at https://search.google.com/test/rich-results." },
    ],
  },

  redirect: {
    deliverable: "redirect",
    platform: "shopify",
    title: "Set up a 301 redirect in Shopify",
    estimatedMinutes: 5,
    steps: [
      { text: "In the Shopify admin, go to Online Store > Navigation." },
      { text: "Click 'View URL redirects' (at the bottom of the Navigation page, or find 'URL Redirects' in the left sidebar under Online Store)." },
      { text: "Click 'Create URL redirect'." },
      { text: "In the 'Redirect from' field, enter the old path (starting with /):", copyable: { label: "From path", valueKey: "current_value" } },
      { text: "In the 'Redirect to' field, enter the destination:", copyable: { label: "To URL", valueKey: "proposed_value" } },
      { text: "Click 'Save redirect'. All Shopify redirects are 301 by default." },
      { text: "Test in an incognito window by visiting the old URL -- it should land on the destination." },
    ],
  },

  canonical: {
    deliverable: "canonical",
    platform: "shopify",
    title: "Set a custom canonical URL in Shopify",
    estimatedMinutes: 10,
    prerequisites: ["Access to Online Store > Themes > Edit code"],
    steps: [
      { text: "Shopify auto-generates canonical tags using the page's primary URL. To override, you must edit the theme.", warning: "Only override the canonical if Shopify's auto-generated canonical is incorrect -- for example, pointing to a variant URL instead of the canonical product URL. Shopify's auto-canonical is usually correct." },
      { text: "Go to Online Store > Themes > Actions > Edit code." },
      { text: "Open layout/theme.liquid. Find the existing canonical tag, which looks like: <link rel=\"canonical\" href=\"{{ canonical_url }}\">" },
      { text: "Replace that line with a conditional. For a specific page handle:", copyable: { label: "Canonical URL", valueKey: "proposed_value" } },
      { text: "Example: {% if page.handle == 'target-page' %}<link rel=\"canonical\" href=\"[canonical URL]\">{% else %}<link rel=\"canonical\" href=\"{{ canonical_url }}\">{% endif %}" },
      { text: "Click 'Save'. View-source the page and search for 'canonical' to verify." },
    ],
  },

  alt_text: {
    deliverable: "alt_text",
    platform: "shopify",
    title: "Add alt text to an image in Shopify",
    estimatedMinutes: 3,
    steps: [
      { text: "For a product image: go to Products > click the product > click the image thumbnail > update the 'Alt text' field that appears." },
      { text: "For a page or blog image added via the editor: open the page/post in the editor, click the image, then click 'Edit' to update the alt text field.", copyable: { label: "Alt text", valueKey: "proposed_value" } },
      { text: "For theme images or images in Files: go to Content > Files > find the image > click 'Edit' to update alt text." },
      { text: "Click 'Save' (or 'Done' for product images)." },
    ],
  },

  robots_txt: {
    deliverable: "robots_txt",
    platform: "shopify",
    title: "Update robots.txt in Shopify",
    estimatedMinutes: 8,
    steps: [
      { text: "Shopify Plus plans: go to Online Store > Themes > Actions > Edit code. Look for a file named 'robots.txt.liquid' in the Templates section. If it does not exist, create it.", warning: "Editing robots.txt is only available on Shopify Plus. On standard Shopify plans, robots.txt is controlled by Shopify and cannot be customized. If you are on a standard plan, contact Shopify support to request changes." },
      { text: "In the robots.txt.liquid file, paste the new robots.txt content:", copyable: { label: "robots.txt content", valueKey: "proposed_value" } },
      { text: "Click 'Save'." },
      { text: "Visit yourdomain.com/robots.txt in an incognito window to confirm the updated content is live." },
    ],
  },

  sitemap_xml: {
    deliverable: "sitemap_xml",
    platform: "shopify",
    title: "Submit the Shopify sitemap to Google Search Console",
    estimatedMinutes: 4,
    steps: [
      { text: "Shopify automatically generates and maintains a sitemap at yourdomain.com/sitemap.xml. No manual update is needed." },
      { text: "Go to https://search.google.com/search-console and select your property." },
      { text: "Under Indexing > Sitemaps, enter your sitemap URL: yourdomain.com/sitemap.xml" },
      { text: "Click 'Submit'.", warning: "If you have already submitted this sitemap, no action is required -- Shopify keeps it current automatically. Resubmit only if you want to force GSC to re-read it sooner." },
    ],
  },

  indexation_submit: {
    deliverable: "indexation_submit",
    platform: "shopify",
    title: "Request indexation in Google Search Console",
    estimatedMinutes: 3,
    steps: [
      { text: "Go to https://search.google.com/search-console and select your property." },
      { text: "Paste the URL into the inspection bar at the top:", copyable: { label: "URL to submit", valueKey: "page_url" } },
      { text: "Click 'Test Live URL' and confirm there are no crawl or rendering errors." },
      { text: "Click 'Request Indexing'.", warning: "Google limits this to roughly 10 URL requests per day per property." },
    ],
  },
};
