import { Sidebar } from "@/components/layout/Sidebar";

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-56 p-8">{children}</main>
    </div>
  );
}
