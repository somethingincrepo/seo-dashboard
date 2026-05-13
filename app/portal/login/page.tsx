import { redirect } from "next/navigation";

// /portal/login is now deprecated — everyone logs in at /login.
// The unified /login action identifies admin vs portal by credentials
// and redirects each user to the right destination automatically.
export default async function PortalLoginRedirect({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token } = await searchParams;
  if (token) {
    redirect(`/login?next=${encodeURIComponent(`/portal/${token}`)}`);
  }
  redirect("/login");
}
