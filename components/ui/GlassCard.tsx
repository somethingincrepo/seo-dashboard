import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function GlassCard({ children, className, hover }: GlassCardProps) {
  return (
    <div className={cn(
      "bg-white rounded-xl border border-slate-200/80",
      "shadow-[0_1px_2px_0_rgba(16,24,40,0.05),0_1px_3px_0_rgba(16,24,40,0.04)]",
      hover && "hover:shadow-[0_2px_4px_-1px_rgba(16,24,40,0.04),0_4px_8px_-2px_rgba(16,24,40,0.06)] hover:border-slate-300 transition-all duration-200 cursor-pointer",
      className
    )}>
      {children}
    </div>
  );
}
