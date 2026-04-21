import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const authed = await isAdminAuthenticated();
  if (!authed) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-56 p-8">{children}</main>
    </div>
  );
}
