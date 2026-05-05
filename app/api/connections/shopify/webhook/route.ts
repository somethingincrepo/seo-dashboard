import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { getSupabase } from "@/lib/supabase";

// Shopify sends app/uninstalled and shop/redact webhooks. We verify HMAC and
// flip the matching connection to status='revoked'. Body is read raw so the
// HMAC matches what Shopify signed.
export async function POST(request: NextRequest) {
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "Shopify webhook secret not configured" }, { status: 500 });
  }

  const hmac = request.headers.get("x-shopify-hmac-sha256") || "";
  const topic = request.headers.get("x-shopify-topic") || "";
  const shopDomain = request.headers.get("x-shopify-shop-domain") || "";

  const raw = await request.text();
  const computed = createHmac("sha256", secret).update(raw, "utf8").digest("base64");
  const a = Buffer.from(hmac, "base64");
  const b = Buffer.from(computed, "base64");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ ok: false, error: "Invalid HMAC" }, { status: 401 });
  }

  if (topic !== "app/uninstalled") {
    // Acknowledge other topics without state changes.
    return NextResponse.json({ ok: true });
  }

  if (!shopDomain) {
    return NextResponse.json({ ok: false, error: "Missing shop domain" }, { status: 400 });
  }

  const sb = getSupabase();
  const { data: rows } = await sb
    .from("connections")
    .select("id")
    .eq("platform", "shopify")
    .eq("external_site_id", shopDomain);

  for (const r of (rows ?? []) as Array<{ id: string }>) {
    await sb.from("connections").update({ status: "revoked" }).eq("id", r.id);
    await sb.from("connection_events").insert({
      connection_id: r.id,
      event_type: "revoked",
      payload: { source: "shopify_webhook", topic, shop_domain: shopDomain },
    });
  }

  return NextResponse.json({ ok: true });
}
