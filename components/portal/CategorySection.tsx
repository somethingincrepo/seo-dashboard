import { CollapsiblePageGroup } from "@/components/portal/CollapsiblePageGroup";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { Change } from "@/lib/changes";

interface CategorySectionProps {
  category: string;
  changes: Change[];
  token: string;
}

export function CategorySection({ category, changes, token }: CategorySectionProps) {
  // Group by page URL
  const byPage: Record<string, Change[]> = {};
  for (const c of changes) {
    const page = c.fields.page_url || "Site-wide";
    if (!byPage[page]) byPage[page] = [];
    byPage[page].push(c);
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <StatusBadge value={category} variant="category" />
        <span className="text-slate-400 text-xs">{changes.length} change{changes.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="space-y-2">
        {Object.entries(byPage).map(([page, pageChanges], i) => (
          <CollapsiblePageGroup
            key={page}
            page={page}
            changes={pageChanges}
            token={token}
            defaultOpen={i === 0}
          />
        ))}
      </div>
    </section>
  );
}
