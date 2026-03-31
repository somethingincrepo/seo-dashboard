const CHANGE_TITLES: Record<string, string> = {
  "Metadata": "Update page title & description",
  "Heading": "Improve page headings",
  "Schema": "Add structured data for search",
  "Content": "Update page content",
  "FAQ": "Add FAQ section",
  "Redirect": "Fix broken or outdated link",
  "Internal Link": "Improve internal linking",
  "Canonical": "Fix duplicate page signal",
  "GEO": "Optimize for AI search engines",
  "Alt Text": "Add image descriptions",
  "Removal": "Remove outdated content",
};

export function getChangeTitle(type: string, pageUrl: string): string {
  return CHANGE_TITLES[type] || type || "SEO improvement";
}

const CHANGE_DESCRIPTIONS: Record<string, string> = {
  "Metadata": "We'll update the page title and description that appear in Google search results to better match what people are searching for.",
  "Heading": "We'll improve the headings on this page to make them clearer for both search engines and visitors.",
  "Schema": "We'll add structured data to this page so Google can display rich results (like FAQ dropdowns or star ratings) in search.",
  "Content": "We'll update the content on this page to better answer the questions your potential customers are searching for.",
  "FAQ": "We'll add a Frequently Asked Questions section to this page, which can appear directly in Google search results.",
  "Redirect": "We'll fix a broken or outdated link so visitors and search engines reach the right page.",
  "Internal Link": "We'll improve the links between your pages to help search engines discover and rank your important content.",
  "Canonical": "We'll fix a technical signal that's causing search engines to see duplicate versions of this page.",
  "GEO": "We'll optimize this page so your brand appears when people use AI assistants like ChatGPT or Perplexity to research solutions.",
  "Alt Text": "We'll add descriptive text to images on this page, improving accessibility and helping search engines understand your visuals.",
  "Removal": "We'll remove outdated content that may be hurting your search rankings.",
};

export function getRecommendationSummary(type: string, proposedValue: string, pageUrl: string): string {
  return CHANGE_DESCRIPTIONS[type] || "We'll make an optimization to this page to improve its search visibility.";
}

export const CATEGORY_EXPLANATIONS: Record<string, string> = {
  "Technical": "Technical SEO fixes help search engines crawl and understand your site correctly. These changes don't affect what visitors see on your pages.",
  "On-Page": "On-page changes improve how your content appears to both search engines and visitors. Some changes may be visible on the page.",
  "Content": "Content updates help your pages better answer the questions your potential customers are searching for.",
  "AI-GEO": "AI search optimization helps your brand appear when people use AI assistants like ChatGPT, Perplexity, or Google AI Overviews to research solutions.",
};

export const QUICK_WIN_EXPLANATION = "Quick wins are safe changes with no visual impact on your site. They improve technical SEO signals without changing anything your visitors see.";

export function getConfidenceLabel(confidence: string): string {
  const map: Record<string, string> = { "High": "High confidence", "Medium": "Medium confidence", "Low": "Lower confidence" };
  return map[confidence] || confidence;
}
