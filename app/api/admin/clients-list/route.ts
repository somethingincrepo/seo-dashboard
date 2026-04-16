import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClients } from "@/lib/clients";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const clients = await getClients();
  const list = clients.map((c) => ({
    id: c.id,
    name: c.fields.company_name,
  }));
  return NextResponse.json({ clients: list });
}
