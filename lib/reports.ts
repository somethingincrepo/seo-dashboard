// Reports are stored in Supabase — all reads go through the Supabase client.
// Types are defined in lib/supabase.ts alongside the query helpers.

export type {
  SupabaseReport,
  RankingEntry,
  PageEntry,
  TrendEntry,
  AiSourceEntry,
  ArticleEntry,
  RankingArticle,
  FaqPage,
  QueueItem,
  AiMention,
  PageOptimized,
  KeywordEntry,
} from "./supabase";

export {
  getClientReportsFromSupabase as getClientReports,
  getAllReportsFromSupabase as getAllReports,
} from "./supabase";
