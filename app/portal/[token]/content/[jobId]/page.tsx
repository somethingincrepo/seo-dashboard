import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getContentJobById, getContentResultsForClient } from "@/lib/content";
import { ArticleReviewPanel } from "./ArticleReviewPanel";

export const dynamic = "force-dynamic";

export default async function ArticleReviewPage({
  params,
}: {
  params: Promise<{ token: string; jobId: string }>;
}) {
  const { token, jobId } = await params;

  const client = await getClientByToken(token);
  if (!client) notFound();

  const companyName = client.fields.company_name || "";

  const [job, allResults] = await Promise.all([
    getContentJobById(jobId),
    getContentResultsForClient(companyName),
  ]);

  if (!job) notFound();

  const result = allResults.find((r) => r.fields["Job ID"]?.includes(jobId)) ?? null;

  return <ArticleReviewPanel job={job} result={result} token={token} />;
}
