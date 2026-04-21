import { NextRequest, NextResponse } from "next/server";
import {
  getSession,
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  updateAdminUser,
  resetPassword,
  type AdminRole,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await listAdminUsers();
  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { username?: string; password?: string; role?: AdminRole };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { username, password, role = "viewer" } = body;
  if (!username || !password) {
    return NextResponse.json({ error: "username and password are required" }, { status: 400 });
  }

  const result = await createAdminUser(username, password, role);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = request.nextUrl;
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  let body: { role?: AdminRole; assigned_client_ids?: string[]; new_password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Password reset
  if (body.new_password) {
    const result = await resetPassword(id, body.new_password);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  // Role / client assignment update
  const updates: { role?: AdminRole; assigned_client_ids?: string[] } = {};
  if (body.role !== undefined) updates.role = body.role;
  if (body.assigned_client_ids !== undefined) updates.assigned_client_ids = body.assigned_client_ids;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const result = await updateAdminUser(id, updates);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = request.nextUrl;
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const users = await listAdminUsers();
  const target = users.find((u) => u.id === id);
  if (target?.username === session.username) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const adminCount = users.filter((u) => u.role === "admin").length;
  if (target?.role === "admin" && adminCount <= 1) {
    return NextResponse.json({ error: "Cannot delete the last admin account" }, { status: 400 });
  }

  await deleteAdminUser(id);
  return NextResponse.json({ ok: true });
}
